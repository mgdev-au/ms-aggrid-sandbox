import React, {useState} from 'react';
import PropTypes from 'prop-types';
import {cloneDeep, isEmpty, isEqual,} from 'lodash';
import startCase from 'lodash/startCase';
import {AgGridReact} from 'ag-grid-react';
import {AllModules} from 'ag-grid-enterprise';

import FormatStatusStreamAgGrid from 'MSFormatStatusStream/MSFormatStatusStreamAgGrid.js';
import {FormatTextAreaFactoryAgGrid} from 'MSFormatTextArea/MSFormatTextArea.js';
import MSAgDropdownCellEditor from 'MSAgDropdownCellEditor/MSAgDropdownCellEditor.js';
import MSAgDropdownCellRenderer from 'MSAgDropdownCellEditor/MSAgDropdownCellRenderer.js';
import MSAgTreeComboCellEditor from 'MSAgDropdownCellEditor/MSAgTreeComboCellEditor.js';
import MSAgGroupedDataRenderer from 'MSAgGroupedDataRenderer/MSAgGroupedDataRenderer.js';

import { formatDateObj, formatDateTime, formatLookUp, formatOptions } from 'Format.js';
import {
  DecimalFormatter,
  DecimalSetter,
  FormatDateTimeFactoryAgGrid,
  formatIconFactory,
  FormatIconFactoryAgGrid,
  formatRowKeyForNewRow,
  formatWhole,
  FormatWholeAgGrid,
  isEmptyString,
  isNullOrUndefined,
  isArrayNullOrEmpty,
  momentDateFormat,
  momentTimeFormat,
  parseBool,
} from 'CommonUtil.js';
//Jest fails with alias import of indirect export - import .. as + export *
import {isDropdownType, isEmpty as commonUtil_IsEmpty} from 'Check.js';
import MSAgBooleanCellEditor from 'MSAgBoolean/MSAgBooleanCellEditor';
import MSAgBooleanCellRenderer from 'MSAgBoolean/MSAgBooleanCellRenderer';
import MSAgAttachmentsCellRenderer from 'MSAgAttachments/MSAgAttachmentsCellRenderer';
import {
  data_serverDateFormat_DateFns,
  PENDING_ACTION_STATUS, RECORD_TYPE,
  serverTimeFormat,
  HIERARCHY_DELIMITER,
  processingStatusPage,
  NEW_ROW_KEY,
} from 'Constants';
import MSTableDatePickerEditor from 'MSTableDatePicker/MSTableDatePickerEditor';
import MSTextAreaModalAgGrid from 'MSTextAreaModal/MSTextAreaModalAgGrid';
import {SecondaryButton, StyledAgGridSaveButton, StyledDataViewDropdownButton,} from 'Styled/StyledComponents.js';
import styled, {withTheme} from 'styled-components';
import MSAgContextMenuCellRenderer from 'MSAgContextMenuCellRenderer/MSAgContextMenuCellRenderer.js';
import {
  getPageContext,
  hideLoadingSpinner,
  insertOrUpdateCellsInAddingActionInAGGrid,
  setPageContext,
  showLoadingSpinner,
  updateCellsInEditActionAGGrid,
} from 'Actions.js';
import {getStore} from 'GlobalStore.js';
import {sanitizeColumn} from 'AgGridUtil.js';
import {isCellEditable, isRowEditable} from 'TableUtils';
import MSTransitionModal from 'MSTransitionModal/MSTransitionModal.js';
import MSWarnings from 'MSWarnings/MSWarnings';
import MSPromptModal from 'MSPromptModal/MSPromptModal';
import format from 'date-fns/format';
export const DataViewDropdown = styled(StyledDataViewDropdownButton)`
  margin-right: 10px;
`;

const StyledButton = styled(SecondaryButton)`
  margin-left: 10px;
`;

const GridWrapper = styled.div(
  props => ({
    // paddingBottom: '20px', // obscures gray-ish page background with 20px of white
    width: '100%',
    // set height dynamically from props
    height: props.gridHeight? `${props.gridHeight}px`:`calc(100vh - ${210 + parseInt(props.filterBarHeight||0, 10)}px)`,
  })
);

export const rowCountWarning = 'Record limit reached, please adjust your filters.';

// React Functional Component for ag-grid footer row-count warning
const RowCountWarning = (props) => {
  const parentOnlyRowFilter = (rowNode) => isEmptyString(rowNode.data.parentId);
  const getRowCount = () => props.api?.rowModel?.rowsToDisplay?.filter(parentOnlyRowFilter).length;
  const [rowCount, setRowCount] = useState(getRowCount());

  const updateRowCount = () => {
    console.log ('StatusBarWarningComp event listener - rowDataChanged', getRowCount());
    setRowCount(getRowCount());
  };

  props.api.addEventListener('rowDataChanged', updateRowCount);
  props.api.addEventListener('rowDataUpdated', updateRowCount);

  return (
    <div className="ag-name-value">
      <span
        className="component ag-status-panel"
        style={{
          color:  props.theme?.warningIcon || '#DC9057',
          fontWeight: 'normal',
          padding: '8px',
        }}
      >
        {
          rowCount < props.maxRows ?
            '' :
            rowCountWarning
        }
      </span>
    </div>
  );
};

class MGTable extends React.Component {
  constructor(props) {
    super(props);
    // this.maximumLocalRowDataLength = maxRecordsFromServer;
    const self = this;
    let stateData = {
      modules: AllModules,
      columnDefs: [],
      rowData: [],
      defaultColDef: {
        suppressSyncValuesAfterDataChange: false, //Refresh filter values after editing cells
        resizable: true,
        filter: true, // set filtering on for all cols
        filterParams: {
          clearButton: true
        }
      },
      // rowModelType : 'serverSide',
      refreshTable: false,
      multiSortKey: 'ctrl',
      rowSelection: 'multiple',
      overlayLoadingTemplate: '<span class="ag-overlay-loading-center">Please wait while your rows are loading</span>',
      // cacheBlockSize: maxRecordsFromServer,
      maxBlocksInCache: 17,
      rowGroupPanelShow: 'never',
      isCopyDisabled: true,
      isPasteDisabled: true,
      isDeleteActive: false,
      frameworkComponents: {
        FormatStatusStreamAgGrid,
        FormatTextAreaFactoryAgGrid,
        MSAgDropdownCellEditor,
        MSAgDropdownCellRenderer,
        MSAgTreeComboCellEditor,
        MSTableDatePickerEditor,
        MSAgAttachmentsCellRenderer,
        // FormatBooleanFactoryAgGrid,
        // FormatBooleanFactoryAgGridEditor,
        MSAgBooleanCellRenderer,
        MSAgBooleanCellEditor,
        FormatWholeAgGrid,
        FormatIconFactoryAgGrid,
        MSTextAreaModalAgGrid,
        MSAgGroupedDataRenderer,
        MSAgContextMenuCellRenderer,
        rowCountWarning: this.rowCountWarningComponent,
      },
      isServerSideGroup: function(dataItem) {
        return dataItem.group;
      },
      getServerSideGroupKey: function(dataItem) {
        return dataItem.id;
      },
      // This doesn't really need to be in state.  It's here as a vestige of a
      // failed experiment to dynamically change the status bar.  Failed because
      // ag-grid (22) only seems to look at its statusBar prop once, on create.
      statusBar: this.statusBar(),
      suppressKeyboardEvent: function(params) {
        const KEY_C = 67;
        const KEY_V = 86;
        const event = params.event;
        const key = event.which;
        const keysToSuppress = [];
        if (event.ctrlKey || event.metaKey) {
          keysToSuppress.push(KEY_C);
          keysToSuppress.push(KEY_V);
        }
        // do not copy pending changes row
        if (key === KEY_C) {
          self.onCopyRow();
        }
        if (key === KEY_V && !isEmpty(self.copiedRow)) {
          self.onPasteRow();
        }
        return keysToSuppress.indexOf(key) >= 0;
      },
      showCopyWarning: false,
    };
    if (this.props.treeDataConfig) {
      const treeDataConfig = this.props.treeDataConfig;
      if (treeDataConfig.treeData) {
        stateData = {
          ...stateData,
          treeData: treeDataConfig.treeData,
          autoGroupColumnDef: treeDataConfig.autoGroupColumnDef,
          getDataPath: function(data) {
            return data.id.split(HIERARCHY_DELIMITER); // FOR ANY HIERARCHY DATA, LETS USE path PROPERTY TO DETERMINE PARENT CHILD RELATIONSHIP.
          }
        };
      }
    }
    this.state = stateData;

    // this might be 5000, later, for production
    this.rowDataServerSide = {};
    this.shouldOnSortChangeSkipFetch = false;
    this.gridDataRendered = false;
    this.firstDataRendered = this.firstDataRendered.bind(this);
    this.cellValueChanged = this.cellValueChanged.bind(this);
    this.rowSelected = this.rowSelected.bind(this);
    this.postSort = this.postSort.bind(this);
    this.isAddDisabled = this.isAddDisabled.bind(this);
    this.toggleCopyWarningModal = this.toggleCopyWarningModal.bind(this);
    this.onCopyRow = this.onCopyRow.bind(this);
    this.onPasteRow = this.onPasteRow.bind(this);
  }

  rowCountWarningComponent = (props) => {
    return RowCountWarning({...props, maxRows: this.props.maxRowCount});
  }

  // statusBarWarningComponent = (showWarning) => {
  //   const result = this.statusBarWarning;
  //   return result;
  // }

  // onCellDoubleClicked (){
  //
  // }

  toggleCopyWarningModal() {
    this.setState({
      showCopyWarning: !this.state.showCopyWarning,
    });
  }

  addEllipsisColumn(columnDefs) {
    const newColumnDefs = columnDefs?.slice(0) || [];
    // push ellipsis to start of columnDefs as we need these columns to pinned to extreme left always.
    newColumnDefs.unshift({
      fieldType: 'CONTEXT_MENU',
      colId: undefined, // set to undefined to hide the column in column filters.
      pinned: 'left',
      width: 40,
      resizable: false,
      lockPinned: true,
      lockPosition: true,
      lockVisible: true,
      suppressMenu: true,
      suppressNavigable: true,
      filter: false,
      suppressToolPanel: true,//It is to not show the column in columnFilterToolsPanel
    });
    return newColumnDefs;
  }

  addRowSelection({rowSelectionConfig, columnDefs}) {
    const newColumnDefs = columnDefs?.slice(0) || [];
    // push row selection to start of columnDefs as we need these columns to pinned to extreme left always.
    newColumnDefs.unshift({
      fieldType: 'ROW_SELECTION',
      colId: undefined, // set to undefined to hide the column in column filters.
      // Hiding header checkbox is not a common feature. So for any table,
      // if we need to hide Header checkbox, we can pass this property.
      headerCheckboxSelection: !rowSelectionConfig.hideHeaderCheckbox,
      checkboxSelection: true,
      pinned: 'left',
      width: 30,
      resizable: false,
      lockPinned: true,
      lockPosition: true,
      lockVisible: true,
      suppressMenu: true,
      suppressNavigable: true,
      headerCheckboxSelectionFilteredOnly: true, // selectAll selects only filtered rows
      filter: false,
      suppressToolPanel: true,//It is to not show the column in columnFilterToolsPanel
    });
    return newColumnDefs;
  }

  cellValueChanged(params) {
    // Lodash isEmpty doesn't work for numbers or boolean
    // if ((params.newValue !== params.oldValue) && !(isEmpty(params.newValue) && isEmpty(params.oldValue))) {

    // const mantissaCharCount = (formatString) => { // e.g. ###,##0.00
    //   const formatArray = formatString.split('.');
    //   const mantissa = formatArray[formatArray.length - 1];
    //   return mantissa.length;
    // };

    const {oldValue, newValue, colDef} = params;
    const { dataviewModel } = this.props;

    // After a cell is edited, we need to re-instantiate the filter with new values
    this.gridApi?.destroyFilter(params.column.colId);
    let valChange = false;
    // console.log('cellValueChanged(): params', params);
    switch (colDef.editorType) {
    case 'DECIMAL':
      // const oldValueIsNumber = typeof oldValue === 'number';
      // valChange = !oldValueIsNumber || newValue !== oldValue?.fixed(mantissaCharCount(colDef.editorParameter));

      // This seems too simple, in particular it will force a save if accuracy
      // varies, e.g. 123.45 vs 123.4567 - but that seems like a good thing.
      // The above was a failed start at rounding per the cell format string.
      valChange = oldValue !== newValue;
      break;
    case 'BOOLEAN':
      // "true" -> true, "false" -> false (not the JS default)
      valChange = parseBool(newValue) !== parseBool(oldValue);
      break;

    // Following checks not required as MSTableDatePickerEditor doesn't return moment object anymore!
    // Calendar changes cell value just on opening - string to moment!
    // case 'APP_DATE_DATE_EDITOR':
    //   const newVal = new Date(params.newValue).setHours(0,0,0); //we care about date only
    //   const oldVal = new Date(params.oldValue).setHours(0,0,0); //we care about date only
    //   valChange = !isEqualDate(newVal, oldVal);
    //   break;
    // case 'APP_DATE_TIME_EDITOR':
    //   if (moment.isMoment(params.oldValue) && moment.isMoment(params.newValue)) {
    //     valChange = !params.oldValue.isSame(params.newValue);
    //   } else {
    //     valChange = params.oldValue !== params.newValue;
    //   }
    //   break;
    // case 'APP_DATE_DATE_TIME_EDITOR':
    //   const newVal = new Date(params.newValue);
    //   const oldVal = new Date(params.oldValue);
    //   valChange = !isEqualDate(newVal, oldVal);
    //   break;

    case 'LOOKUP':
    case 'LOOKUP_VALUE':
    case 'ENUM':
    case 'WORKTABLE_COLUMN_DATA':
    case 'PRICE_RUN_TYPE':
    case 'FX_RATE_TYPE':
    case 'COMMON_ENTITY':
      // handle object value from dropdown editor - {code, description}
      if(params.newValue?.code) {
        if(params.oldValue?.code){
          valChange = params.newValue.code !== params.oldValue.code;
        }else {
          valChange = params.newValue.code !== params.oldValue;
        }
      }else{
        valChange = params.newValue !== params.oldValue;
      }
      break;
    default:
      // Why do we need isEmpty check? texteditor returns "", so undefined -> ""
      valChange = newValue !== oldValue && !(isEmpty(newValue) && isEmpty(oldValue));
    }
    // console.log('valChange', valChange);
    if (isCellEditable(params.data, colDef, dataviewModel) && valChange && !(commonUtil_IsEmpty(newValue) && commonUtil_IsEmpty(oldValue))){
      updateCellsInEditActionAGGrid(this.props.tableName, params, newValue, this.props.cellsInEdit,'UPDATE', this.props.rowKey, params.column.colId, this.props.dualKey);
    }
  }

  addCellEditCallback(colDefs){
    const { dataviewModel } = this.props;
    colDefs.forEach(colDef=>{
      colDef.editable = params => {
        return isCellEditable(params.data, colDef, dataviewModel);
      };
      colDef.onCellValueChanged=this.cellValueChanged;
    });
    return colDefs;
  }
  formatColumnDefs(inputColumnDefs){
    let columnDefs = cloneDeep(inputColumnDefs);
    // Don't change order of columnDefs
    if (this.props.contextMenu) {
      columnDefs = this.addEllipsisColumn(columnDefs);
    }
    columnDefs = this.configureRowSelectionCheckbox({ rowSelectionConfig: this.props.rowSelectionConfig, columnDefs });
    columnDefs = this.setCellRenders(columnDefs);
    columnDefs = this.formatColumnFilters(columnDefs);
    columnDefs = this.showUnsortedIcon(columnDefs);
    columnDefs = this.addCellEditCallback(columnDefs);
    columnDefs = this.applyAppropriateCompareFunction(columnDefs); // for sorting
    columnDefs = this.hideAutoGroupedColumn(columnDefs);

    return columnDefs;
  }
  componentDidMount() {
    if (this.props.columnDefs) { // maybe this is never true here
      const columnDefs = this.formatColumnDefs(this.props.columnDefs);
      this.setState({
        columnDefs,
        rowData: this.props.rowData,
      });
    }
  }

  setDefaultSort = (doFetch) => {
    const sortModel = this.props?.dataviewModel?.agGridDefaultSortColumns;
    const pageContext = getPageContext(this.props?.pageName);
    // On navigating back to original worktable, for retaining the context of sort
    if(pageContext?.context && !isEmpty(pageContext?.context?.sort)){
      this.shouldOnSortChangeSkipFetch = !doFetch;
      this.gridApi?.sortController.setSortModel(pageContext.context.sort);
    }
    else if (Array.isArray(sortModel)) {
      this.shouldOnSortChangeSkipFetch = !doFetch;
      this.gridApi?.sortController.setSortModel(sortModel);
      // console.log('setDefaultSort - setting default sort model', sortModel);
    }
    else {
      // console.log('setDefaultSort - error, not setting default sort model');
    }
  }

  // This method handles adding of rowSelection checkbox based on condition.
  configureRowSelectionCheckbox({rowSelectionConfig, columnDefs}){
    if (rowSelectionConfig) {
      columnDefs = this.addRowSelection({rowSelectionConfig, columnDefs});
    }
    return columnDefs;
  }

  hideAutoGroupedColumn(columnDefs) {
    const { treeDataConfig } = this.props;
    if (!treeDataConfig) {
      return columnDefs;
    }
    return columnDefs?.map(
      p => {
        if (p.fieldName === treeDataConfig?.columnToHide) {
          // if we don't remove colId then we are getting the unwanted column in filter
          return {...p, hide: true, suppressToolPanel: true, lockVisible: true, colId: undefined};
        }
        return p;
      }
    );
  }

  componentDidUpdate(prevProps) {
    if (this.props.columnDefs && this.props.columnDefs !== prevProps.columnDefs) {
      const columnDefs = this.formatColumnDefs(this.props.columnDefs);
      this.setState({
        columnDefs,
      });
    }
    const rowsDidUpdate = !isEqual(this.props.rowData, prevProps.rowData);
    if (rowsDidUpdate && !this.props?.cellsInEdit?.[this.props.tableName]?.cells?.length) {
      //Clear highlight of selected node
      if(!this.props.isChildApiCallMade){ //it is for tree structure data like processingStatus screen, when the row is expanded, selectedNode should persist
        this.selectedNode = null;
      }
      this.setState({
        rowData: this.props.rowData,
        selectedRowId: null,
        isDeleteActive: false
      });
      this.gridApi?.setRowData(this.props.rowData)?.();
    }
    if (this.props.filterState !== prevProps.filterState) {
      this.refreshTable();
    }
    // TODO will this cause an extra fetch if row count > 2000?
    // TODO is there a cleaner or existing mechanism re this.gridDataRendered?

    // this.gridDataRendered indicates a completed render of rows.
    // Purpose: when navigating away, then returning, rows are not
    // yet rendered in ag-grid, so setting default sort won't work.
    // So, we prevent setDefaultSort unless gridDataRendered is true
    if (
      this.gridDataRendered &&
      (rowsDidUpdate ||
      this.props.dataviewModel?.agGridDefaultSortColumns !==
      prevProps.dataviewModel?.agGridDefaultSortColumns)
    ) {
      this.setDefaultSort(false);
    }
  }

  onColumnResizeEvent = (e, a , b) => {
    if (e.finished) {
      console.log(this, e, a, b);
    }
  }

  postSort(rowNodes) {
    function isNewRecord(node) {
      return node.data?.recordType === RECORD_TYPE.NEW;
    }
    function moveToTop(toIndex,fromIndex){
      rowNodes.splice(toIndex, 0, rowNodes.splice(fromIndex, 1)[0]);
    }
    function move(fromIndex, selectedNodeId) {
      const row = rowNodes[fromIndex];
      rowNodes.splice(fromIndex,1);
      const newPosition = findIndexByNodeId(selectedNodeId);
      rowNodes.splice(newPosition,0,row);
    }
    function findIndexByNodeId(nodeId){
      return rowNodes.findIndex((row) => isEqual(nodeId,row.id));
    }

    function findNodesAssociatedWithNode(nodeId){
      return rowNodes.filter((row) => isEqual(row.data.attachedRowNodeId,nodeId));
    }

    function isCalledBecauseOfNewRow() {
      return rowNodes.filter((row) => isNullOrUndefined(row.rowIndex)).length > 0;
    }
    if (isCalledBecauseOfNewRow()) {
      const selectedNodes = this.gridApi?.getSelectedNodes?.();

      if (selectedNodes?.length) {
        selectedNodes.forEach((node) => {
          const attachedNodes = findNodesAssociatedWithNode(node.id);
          attachedNodes.forEach((attachedNode) => {
            const addedRowPosition = findIndexByNodeId(attachedNode.id);
            move(addedRowPosition, node.id);
          });
        });
      } else {
        let nextPosition = 0;
        rowNodes.forEach((row,index) => {
          if (isNewRecord(row) && !row.data.attachedRowNodeId) {
            moveToTop(nextPosition++, index);
          }
        });
      }
    }else{
      for (let i = 0; i < rowNodes.length; i++) {
        delete rowNodes[i].data.attachedRowNodeId;
      }
    }
  }

  getRowHeight = () => {
    return 36; // this must match $row-height in styles/ag-grid.scss
  }

  // eslint-disable-next-line consistent-return
  extractRowsFromData = (groupKeys, data) => {
    if (groupKeys.length === 0) {
      return data.map(d => {
        return {
          ...d,
          group: !!d.children,
        };
      });
    }
    const key = groupKeys[0];
    for (let i = 0; i < data.length; i++) {
      if (data[i].id === key) {
        return this.extractRowsFromData(groupKeys.slice(1), data[i].children.slice());
      }
    }
  }

  getData = async (params) => {
    console.log ('**** getData called with', params);
    const response = await this.props?.fetchTableDataNow(this.props.filterState, params.request);

    // Temporary limiting of number of return rows to props.maxRowCount.
    // Later the server will do this limiting.
    if (this.props.treeData) {
      response.rows = this.extractRowsFromData(params.request.groupKeys, response.rows);
    }
    if (isEmpty(this.state.columnDefs)) {
      let columnDefs = this.setCellRenders(this.props.columnDefs.slice(0));
      // Don't change order of columnDefs
      if (this.props.contextMenu) {
        columnDefs = this.addEllipsisColumn(columnDefs, this.props.enableRowSelection);
      }
      columnDefs = this.configureRowSelectionCheckbox({rowSelectionConfig: this.props.rowSelectionConfig, columnDefs});
      this.setState({
        columnDefs,
      });
    }
    return response;
  }

  shouldDoServerSort = () => {
    // The server return smaxRowCount + 1 records to indicate
    // there are more records.
    let result = true;
    if (this.props.allowLocalSort) {
      result = !this.serverDidReturnAllRecords(
        this.props.rowData?.length,
        this.props.maxRowCount
      );
    }
    // console.log('shouldDoServerSort returning', result);
    return result;
  }

  // these two methods facilitate unit testing
  serverDidReturnAllRecords = (returnedRowCount, expectedMaximumCount) => {
    const result = returnedRowCount === undefined || returnedRowCount < expectedMaximumCount;
    return result;
  }

  didSortModelChange = (currentSortModel) => {
    // const currentSortModel = this.gridApi?.sortController.getSortModel();
    let result = false;
    if (
      isArrayNullOrEmpty(this.previousSortModel) !==
      isArrayNullOrEmpty(currentSortModel)
      // !Array.isArray(currentSortModel) // lets undefined apply the default filter.
    ) {
      result = true; // if no previous and/or current sort model then set changed true
    }
    else {
      if (
        Array.isArray(this.previousSortModel) &&
        Array.isArray(currentSortModel)
      ) {
        currentSortModel.forEach((value, index) => {
          const previousValue = this.previousSortModel[index];
          if (
            value?.colId !== previousValue?.colId ||
            value?.sort !== previousValue?.sort
          ) {
            result = true; // should stop checking after this
          }
        });
      }
    }
    // console.log('didSortModelChange returning', result, 'current', currentSortModel, 'previous', this.previousSortModel);
    this.previousSortModel = cloneDeep(currentSortModel);
    // console.log('didSortModelChange updated previousSortModel', this.previousSortModel);

    return result;
  }

  // ag-grid can add e.g. '_1' to colId if the code hasn't explicitly
  // set the colId. The Java backend throws. This removes that and any
  // other issues.

  // Also sets the sort key for a customized ag-grid tree-grouping column
  tweakSortModel (sortModel) {
    // cloning probably not necessary - testing needed
    const result = cloneDeep(sortModel);
    result.forEach((column) => {
      column.colId = sanitizeColumn(column.colId);

      // Fix sort description for the special tree-grouping column
      if (column.colId === 'ag-Grid-AutoColumn') {
        column.colId = this.props.treeDataConfig.autoGroupColumnDef.sortKey;
      }
    });
    return result;
  }

  onSortChanged = async (params) => {
    // const currentSortModel = this.gridApi?.sortController.getSortModel();
    showLoadingSpinner({transparent: true});
    const sortModelRaw = params?.api.getSortModel() || [];
    // console.log('onSortChanged - sort model', sortModelRaw);

    // run didSortModelChange explicitly, outside the if, to
    // ensure side effect of updating this.previousSortModel
    const sortModelDidChange = this.didSortModelChange(sortModelRaw);
    if (
      !sortModelDidChange ||
      this.shouldOnSortChangeSkipFetch
    ) {
      this.shouldOnSortChangeSkipFetch = false; // clear the flag and return
    }
    else {
      const sortModel = this.tweakSortModel(sortModelRaw);
      if (this.shouldDoServerSort()) {
        await this.getData({request: {sortModel}});
        this.shouldOnSortChangeSkipFetch = true; // probably don't need this, but just in case sortModelDidChange fails...
        this.gridApi?.setSortModel(sortModelRaw);
        const nodeToSelect = this.rowNodeWithDataKeyAndValue(
            this.props.rowKey, this.state.selectedRowId
        );
        nodeToSelect?.setSelected(true);
      }
      else {
        // console.log('local sort');
      }
      this.scrollToSelected();
    }
    hideLoadingSpinner();
  }

  rowSelected(params){
    if(params?.data?.[this.props.rowKey] === this.selectedNode?.data?.[this.props.rowKey]){
      this.selectedNode=null;
    }
  }

  // ag-grid callback
  isRowSelectable = (rowNode) => {
    let result = true;
    if (this.props.isRowSelectable) {
      result = this.props.isRowSelectable(rowNode);
    }
    return result;
  }

  onSelectionChanged = () => {
    const {rowKey: rowIdColumn} = this.props;
    this.setState({
      selectedRows: this.gridApi.getSelectedRows()
    });
    if (this.gridApi.getSelectedNodes().length > 0) {
      const selectedNodeData = this.gridApi.getSelectedNodes()?.[0]?.data?.values;
      const idColumnExists = Object.keys(selectedNodeData).find(
        (column) => column === rowIdColumn
      );
      const selectedRowId = idColumnExists ? selectedNodeData[rowIdColumn] : undefined;
      this.setState({
        selectedRowId: selectedRowId,
        isDeleteActive: this.isDeleteAvailable(),
        isCopyDisabled: !this.props.dataViewConfig?.appendable || false,
      });
    }
    else {
      this.setState({selectedRowId: null,isDeleteActive: false, isCopyDisabled: true});
    }
  }

  // Scrolls to first selection in selection array using the default
  // scroll location which is scroll-as-little-as-possible.
  // For server sorts We keep track of the last-selected scroll
  // and scroll to that IF the previous selection is in the new
  // result set from the server
  scrollToSelected = () => {
    let firstSelectionIndex;
    if (this.shouldDoServerSort()) {
      const selectedRow = this.rowNodeWithDataKeyAndValue(
        this.props.rowKey,
        this.state.selectedRowId
      );
      if (selectedRow) { // maybe no prev selection or its not in result array
        firstSelectionIndex = selectedRow.rowIndex;
      }
    }
    else {
      const selection = this.gridApi.getSelectedNodes();
      if (selection.length >= 1) {
        const firstSelected = selection[0];
        firstSelectionIndex = firstSelected.rowIndex;
        // console.log('local sort, firstSelectionIndex', firstSelectionIndex);
      }
    }
    if (firstSelectionIndex >= 0) {
      this.gridApi.ensureIndexVisible(firstSelectionIndex);
    }
  }

  rowNodeWithDataKeyAndValue = (key, value) => {
    let result; // default if previous selection not in result set
    this.gridApi.forEachLeafNode(
      (rowNode, index) => {
        const rowIdValue = rowNode.data[key];
        // console.log('rowIdValue', rowIdValue);
        if (
          !result && // quit looking once we've found a match (how to exit?)
          rowIdValue === value
        ) {
          result = rowNode;
        }
      }
    );
    return result; // can return undefined
  }

  // There are instances where few rows are selected using checkbox and contextmenu of another row can be clicked. Clickedrow contains data of the row for which context menu is clicked.
  getContextMenuItemsFromApi = async (clickedRow, rowNode) => {
    this.prevNode=this.props.selectedRowNode;
    this.selectedNode=rowNode;
    //When clicked on ellipsis, un-highlight the previously selected row and highlight the current selected row
    this.gridApi.redrawRows({rowNodes: [this.selectedNode, this.prevNode]});
    const selectedRows = this.gridApi.getSelectedRows();
    return this.props.contextMenu.getContextMenuItems?.(this.props.tableName, this.props.dataViewConfig.selectedDataView.code, clickedRow, selectedRows, rowNode);
  }

  suppressKeyboardEvent = (params) => {
    const KEY_UP = 38;
    const KEY_DOWN = 40;
    const KEY_ENTER = 13;
    // return true (to suppress) if editing and user hit up/down keys
    const keyCode = params.event.keyCode;
    const gridShouldDoNothing = params.editing && (keyCode===KEY_UP|| keyCode===KEY_ENTER || keyCode===KEY_DOWN);
    return gridShouldDoNothing;
  }

  getIntialItems = (clickedRow,rowNode) => {
    return this.props.contextMenu?.getIntialItems?.(this.props.tableName, this.props.dataViewConfig.selectedDataView.code, clickedRow, rowNode);
  }

  shouldShowContextMenu = (rowNode) => {
    let result = true;
    if (this.props.contextMenu.shouldShowContextMenu) {
      result = this.props.contextMenu.shouldShowContextMenu(rowNode);
    }
    return result;
  }

  //PWP-1681: Format filter values
  formatColumnFilters(columnDefs){
    columnDefs.forEach(colDef => {
      switch(colDef.rendererType){
      case 'APP_DATE_DISPLAY_DATE':
      case 'APP_DATE_DISPLAY_DATE_TIME':
        switch(colDef.rendererParameter){
        case 'dd-MMM-yyyy':
          colDef.keyCreator=dateKeyCreator;
          colDef.filter='agSetColumnFilter';
          break;
        case 'dd-MMM-yyyy HH:mm:ss':
          colDef.keyCreator=dateTimeKeyCreator;
          colDef.filter= 'agSetColumnFilter';
          break;
        default:
          break;
        }
        break;
      case 'APP_DATE_DISPLAY_TIME':
        colDef.keyCreator=timeKeyCreator;
        colDef.filter='agSetColumnFilter';
        break;
      case 'COMMON_ENTITY':
      case 'LOOKUP':
      case 'LOOKUP_VALUE':
      case 'ENUM':
      case 'WORKTABLE_COLUMN_DATA':
      case 'PRICE_RUN_TYPE':
        colDef.keyCreator = dropDownKeyCreator.bind(this, colDef); //agGrid doesn't pass colDef
        break;
      default:
        break;
      }
    });
    return columnDefs;
  }

  setCellRenders = (columnDefs) => {
    const that = this;
    columnDefs.forEach(col => {
      //Ag-grid appends _1 to colid's if change in dataviews, it is causing issue with retaining context, so giving column.fieldname as colid
      col.colId = col?.fieldName || col?.colId || '';
      // set to undefined to hide the column in column filters
      if(col.fieldType === 'CONTEXT_MENU' || col.fieldType === 'ROW_SELECTION'){
        col.colId = undefined;
      }
      switch (col.fieldType) {
      case 'CONTEXT_MENU':
        col.cellRenderer = 'MSAgContextMenuCellRenderer';
        col.cellRendererParams= {
          getContextMenuItemsFromApi: this.getContextMenuItemsFromApi.bind(that),
          getIntialItems: this.getIntialItems.bind(that),
          shouldShowContextMenu: this.shouldShowContextMenu.bind(that)
        };
        break;
      case 'STATUS_STREAM':
        col.cellRenderer = 'FormatStatusStreamAgGrid';
        break;
      case 'TEXT_AREA':
        col.cellRenderer = 'FormatTextAreaFactoryAgGrid';
        col.cellEditor = 'agLargeTextCellEditor';
        col.cellEditorParams = {
          maxLength: '6000000', // override the editor defaults (maxLength of textArea does not accepting Number.MAX_SAFE_INTEGER, so giving some constant value.)
        };
        break;
      case 'MULTIPLE_TYPES':
        break;
      default:
        break;
      }
      switch(col.rendererType) {
      case 'COMMON_ENTITY':
      case 'LOOKUP':
      case 'LOOKUP_VALUE':
      case 'ENUM':
      case 'WORKTABLE_COLUMN_DATA':
      case 'PRICE_RUN_TYPE':
      case 'PROCESSES':
      case 'COMBINE':
      case 'PROCESS_STATUS':
        col.cellRenderer = 'MSAgDropdownCellRenderer';
        col.cellEditor = 'MSAgDropdownCellEditor';
        // inbuilt select editor
        // col.cellEditor = 'agSelectCellEditor';
        col.cellEditorParams = {
          getDropdownOptions: this.props.getDropdownOptions,
          values: []
          // inbuilt select editor
          // values: ['Porsche', 'Toyota', 'Ford', 'AAA', 'BBB', 'CCC']
        };
        col.suppressKeyboardEvent = this.suppressKeyboardEvent;
        break;
      case 'WORKTABLE_TREE_COMBO':
        col.cellRenderer = 'MSAgDropdownCellRenderer';
        col.cellEditor = 'MSAgTreeComboCellEditor';
        col.cellEditorParams = {
          getDropdownOptions: this.props.getDropdownOptions,
          gridApi: this.gridApi,
          getRowNodeId: this.getRowNodeId,
          values: []
        };
        col.suppressKeyboardEvent = this.suppressKeyboardEvent;
        break;
      case 'DECIMAL':
      case 'MONETARY':
        col.valueSetter = DecimalSetter;
        col.valueFormatter = DecimalFormatter;
        col.cellStyle = {...(col.cellStyle || {}), textAlign: 'right'};
        break;
      case 'APP_DATE_DATE_TIME':
      case 'APP_DATE_DISPLAY_DATE_TIME':
      case 'APP_DATE_DISPLAY_DATE':
      case 'APP_DATE_DISPLAY_TIME':
      case 'DATE':
        col.cellRenderer = FormatDateTimeFactoryAgGrid;
        col.cellRendererParams = {
          noUTC: true,
        };
        col.cellEditor = 'MSTableDatePickerEditor';
        col.cellEditorParams = {
          rowId: this.props.rowId || 'pcontrol_id',
        };
        if (col.rendererType === 'APP_DATE_DISPLAY_DATE' || col.rendererType === 'DATE') {
          col.cellEditorParams.showDatePicker = momentDateFormat;
          col.cellEditorParams.showTimePicker = false;
          col.cellEditorParams.valueFormat = data_serverDateFormat_DateFns;
        } else if (col.rendererType === 'APP_DATE_DISPLAY_DATE_TIME' || col.rendererType === 'APP_DATE_DATE_TIME') {
          col.cellEditorParams.showDatePicker = momentDateFormat;
          col.cellEditorParams.showTimePicker = momentTimeFormat;
          col.cellEditorParams.isISOString = true;
        } else if (col.rendererType === 'APP_DATE_DISPLAY_TIME') {
          col.cellEditorParams.showDatePicker = false;
          col.cellEditorParams.showTimePicker = momentTimeFormat;
          col.cellEditorParams.valueFormat = serverTimeFormat;
          col.cellEditorParams.isTimeOnly = true;
          col.cellRendererParams.isTimeOnly = true;
        }
        break;
      case 'BOOLEAN':
        col.cellEditor = 'MSAgBooleanCellEditor';
        col.cellRenderer = 'MSAgBooleanCellRenderer';
        // col.cellRendererParams = {
        //   onChange: () => null
        // };
        break;
      case 'WHOLE':
        col.cellRenderer = 'FormatWholeAgGrid';
        break;
      case 'ICON':
        col.cellRenderer = 'FormatIconFactoryAgGrid';
        col.cellRendererParams = {
          tableName: this.props.tableName,
        };
        break;
      case 'ATTACHMENTS':
        col.cellRenderer = 'MSAgAttachmentsCellRenderer';
        col.cellRendererParams = {
          tableName: this.props.tableName,
          gridApi: this.gridApi,
          objectId: 'pcontrol_id',
        };
        break;
      default:
        break;
      }
      // removing this doesn't help with losing focus while tabbing open-for-editing cells
      if(col.fieldName === that.props.rowKey){
        col.cellRendererParams = {
          useFormattedValue: true
        };
        col.valueFormatter = formatRowKeyForNewRow;
      }
    });
    return columnDefs;
  }

  // show unsorted icon for sortable columnDefs
  showUnsortedIcon = (columnDefs) => {
    columnDefs.forEach((col) => {
      if (col.sortable) {
        col.unSortIcon = true;
      }
    });
    return columnDefs;
  }

  // Add custom sort compare functions.  So far:
  // 1. case-insensitive sort for text
  // 2. handle text decimal or monetary
  applyAppropriateCompareFunction = (columnDefs) => {
    const compareUndefinedValues = (valueA, valueB) => {
     /* eslint-disable no-eq-null, eqeqeq */
      if (valueA == null && valueB == null) {
        return 0;
      }
      if (valueA == null) {
        return -1;
      }
      if (valueB == null) {
        return 1;
      }
      /* eslint-enable no-eq-null, eqeqeq */
      return null;
    };

    const ensureString = (aValue) => {
      let result = '';
      // eslint-disable-next-line no-eq-null, eqeqeq
      if (aValue != null) {
        result = typeof(aValue) === 'string' ? aValue : aValue.toString();
      }
      return result;
    };

    const caseInsensitiveComparator = (valueA, valueB) => {
      let result = compareUndefinedValues(valueA, valueB);
      if (result === null) {
        // in here, neither value will be null or undefined
        result = ensureString(valueA).toLowerCase().localeCompare(ensureString(valueB).toLowerCase());
      }
      return result;
    };

    // assumes a text represention of a decimal number or money e.g. '$4,321.78'
    const decimalComparator = (valueA, valueB) => {
      let result = compareUndefinedValues(valueA, valueB);
      if (result === null) {
        const numberA = typeof(valueA) !== 'string' ? valueA : valueA.replace('$', '').replace(',', '');
        const numberB = typeof(valueB) !== 'string' ? valueB : valueB.replace('$', '').replace(',', '');
        result = numberA - numberB;
      }
      return result;
    };
    function dropdownTypeComparator (valueA, valueB) {
      if(!valueA || !valueA.hasOwnProperty('code')){
        return -1;
      }
      if(!valueB || !valueB.hasOwnProperty('code')){
        return 1;
      }
      const formatedValueA = formatOptions(valueA, this.rendererParameter).toLowerCase().trim();
      const formatedValueB = formatOptions(valueB, this.rendererParameter).toLowerCase().trim();
      if(formatedValueA < formatedValueB){
        return -1;
      }
      return 1;
    }
    columnDefs.forEach((col) => {
      if (!col.comparator) {
        if (col.sortable) {
          if (
            col.fieldType === 'UNDEFINED' || // text
            // col.fieldType === 'ICON' || // This one is a number per Bobby
            col.fieldType === 'TEXT' || // does this one exist?
            col.fieldType === 'TEXT_AREA' // should we include this in case-insensitive?
          ) {
            col.comparator = caseInsensitiveComparator;
          }
          else if (
            col.fieldType === 'MONETARY' ||
            col.fieldType === 'DECIMAL' // this makes ag-grid sort differently when, say, pcontrol_id fieldtype is set to DECIMAL
          ) {
            col.comparator = decimalComparator;
          }
          if (isDropdownType(col.rendererType)) {
            col.comparator = dropdownTypeComparator;
          }
        }
      }
    });
    return columnDefs;
  }

  // ag grid callback
  onGridReady = async (params) => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
    this.props?.onGridReady?.(this.gridApi);
  }


  refreshTable = () => {
    if (this.gridApi) {
      this.externalFilterTriggered = true;
      this.gridApi.onFilterChanged();
    }
  }

  // onAddRow = () => {
  //   this.rowDataServerSide.rows.splice(0, 0, {});
  //   this.gridApi.purgeServerSideCache();
  // }

  onAddRow = (e) => { // Lets make the parent component to decide where to add a row.
    const selectedRows = this.gridApi.getSelectedNodes();
    let rowNode,addIndex,newItem;
    let latestCellsInEdit;
    if(selectedRows.length>0){
      selectedRows.forEach((row)=>{
        rowNode = this.gridApi.getRowNode(row.id);
        addIndex = rowNode ? rowNode.rowIndex : 0;
        // addIndex = rowNode.rowIndex;
        newItem = this.createNewRowData(row.id);//To add the new row at the top of selected row
        this.gridApi.updateRowData({ add: [newItem], addIndex: addIndex });
        latestCellsInEdit = getStore().getState().app?.cellsInEdit;
        insertOrUpdateCellsInAddingActionInAGGrid(this.props.tableName, [newItem], latestCellsInEdit, this.props.rowKey, this.props.dualKey);
      });
    } else {
      newItem = this.createNewRowData();
      this.gridApi.updateRowData({ add: [newItem], addIndex: 0 });
      insertOrUpdateCellsInAddingActionInAGGrid(this.props.tableName, [newItem], this.props.cellsInEdit, this.props.rowKey, this.props.dualKey);
    }
  }

  onCopyRow = () => {
    if (this.props.dataViewConfig?.appendable) {
      const selectedRows = this.gridApi.getSelectedRows();
      const rowsWithoutPendingChanges = selectedRows.filter(r => r.pendingChangeId === -1);
      if (selectedRows.length) {
        if (rowsWithoutPendingChanges.length) {
          this.copiedRow = cloneDeep(rowsWithoutPendingChanges);
          this.setState({
            isPasteDisabled: false,
          });
        } else {
          this.copiedRow = [];
          this.setState({
            isPasteDisabled: true,
          });
          this.toggleCopyWarningModal();
        }
      }
    }
  };

  onPasteRow = () => {
    if (this.props.dataViewConfig?.appendable) {
      const {tableName, cellsInEdit, rowKey, dualKey} = this.props;
      const focusedCell = this.gridApi.getFocusedCell();
      if (focusedCell) {
        this.copiedRow.forEach(r => {
          r.pcontrol_id = `${new Date().getTime()}${NEW_ROW_KEY}`;
          delete r.values.pcontrol_id;
        });
        this.gridApi.updateRowData({add: this.copiedRow, addIndex: focusedCell.rowIndex + 1});
        insertOrUpdateCellsInAddingActionInAGGrid(tableName, this.copiedRow, cellsInEdit, rowKey, dualKey);
      }
    }
  };

  createNewRowData(attachedRowNodeId) {
    // In modifyProductMasterWorkTableData method, string unique key is being replaced with -1.
    // Hence for all newly added rows, setting uniqueId i.e.., rowKey as string
    const aUniqueKey = `${Date.now()}${NEW_ROW_KEY}`;
    return {
      [this.props.rowKey]: aUniqueKey,
      attachedRowNodeId, //To add the new row at the top of selected row
      recordType: RECORD_TYPE.NEW,
      values:{
        [this.props.rowKey]: aUniqueKey
      },
      rowEditable: true,
      pendingChangeId: -1//Since newly added row is not a pending change
    };
  }

  onRemoveRow = () => {
    // const selectedRows = this.gridApi.getSelectedNodes();
    // if (!selectedRows || selectedRows.length === 0) {
    //   return;
    // }
    // const selectedRow = selectedRows[0];
    // this.rowDataServerSide.rows.splice(selectedRow.rowIndex, 1);
    // this.gridApi.purgeServerSideCache();
    // const selectedRows = this.gridApi.getSelectedNodes();
    // if (!selectedRows || selectedRows.length === 0) {
    //   return;
    // }
    // const selectedRow = selectedRows[0];
    // this.rowDataServerSide.rows.splice(selectedRow.rowIndex, 1);
    // this.gridApi.purgeServerSideCache();

    const selectedRows = this.gridApi.getSelectedRows();

    const existingDeletedRows = [];
    const newlyAddedRows = [];
    console.log('selected rows ', selectedRows);
    selectedRows.forEach((eachRow) => {
      if((eachRow && (eachRow?.pendingChangeId === -1))){
        if (eachRow && eachRow.recordType === RECORD_TYPE.NEW) {
          newlyAddedRows.push(eachRow);
        }
        else {
          eachRow.recordType = RECORD_TYPE.EXISTING_DELETED;
          existingDeletedRows.push(eachRow);
        }
        updateCellsInEditActionAGGrid(
          this.props.tableName,
          {data: eachRow},
          '',
          this.props.cellsInEdit,
          'DELETE',
          this.props.rowKey,
          this.props.rowKey,
          this.props.dualKey
        );
      }
    });
    this.gridApi.updateRowData({ update: existingDeletedRows, remove: newlyAddedRows });
  }

  onCloneRow = () => {
    const selectedRows = this.gridApi.getSelectedNodes();
    if (!selectedRows || selectedRows.length === 0) {
      return;
    }
    const selectedRow = selectedRows[0];
    this.rowDataServerSide.rows.splice(0, 0, cloneDeep(selectedRow.data));
    this.gridApi.purgeServerSideCache();
  }

  handleSave = async () => {
    const response = await this.props?.handleSave();
    if (response) {
      this.setState({
        selectedRowId: null,
        isDeleteActive: false,
        isCopyDisabled: true,
        isPasteDisabled: true,
      }, () => {
        this.gridApi.refreshCells();
        this.refreshTable();
      });
    }
  }


  // what does this callback facilitate?
  getRowNodeId = (data) => {
    return data[this.props.rowKey];
  }

  renderDataView = () => {
    const { dataViewConfig,} = this.props;

    if (
      dataViewConfig?.availableDataViews && dataViewConfig?.availableDataViews?.length
      // && dataViewConfig?.hasRows // we want the dataview menu even if no rows
    ) {
      return (
        <DataViewDropdown
          width={250}
          hasBorder
          id={`${this.props.id}Dataview`}
          title={dataViewConfig.selectedDataView.description || ''}
          options={dataViewConfig.availableDataViews}
          onSelect={dataViewConfig.onSelectDataView}
          selectedOption={dataViewConfig.selectedDataView}
        />
      );
    }
    return null;
  }

  getMainMenuItems = (params) => {
    let defaultMenuItems = params.defaultItems;
    if (this.props.hideExpandAllCollapseAllMenuItems) {
      defaultMenuItems = params.defaultItems.filter(arrayItem =>
      arrayItem !== 'expandAll' && arrayItem !== 'contractAll');
    }
    return defaultMenuItems;
  }

  getContextMenuItems(params) {
    if (params?.column?.colDef?.fieldType === 'CONTEXT_MENU') {
      return params.value;
    }
    return undefined; // Just adding a return statement to avoid lint issues. Need to see what can be done.
  }

  firstDataRendered = async () => {
    const {rowData, tableCode, pageName} = this.props;
    const pageContext = getPageContext(pageName);
    // For context retain of sort, we need to set the sortmodel of pageContext but not default sort
    this.gridDataRendered = true;
    this.setDefaultSort(false);
    if (pageContext?.context && rowData?.length > 0 && tableCode === pageContext?.context?.tableCode) {
      // Retaining the context of the selected (ellipsis clicked) row
      this.selectedNode=pageContext?.context?.rowNode;
      if (this.gridApi) {
        // setting the column filter and columnstate context on navigating back
        this.gridApi.columnController.columnApi.setColumnState(pageContext?.context?.columnState);
        this.gridApi.setFilterModel(pageContext?.context?.filterState);
        // When navigating back to page, selecting rows based on pageContext selectedRows and rowData
        if (pageContext.context.selectedRows.length <= rowData.length / 2) {
          this.gridApi ?.gridOptionsWrapper.gridOptions.api.forEachNode(node => {
            if (pageContext.context.selectedRows.includes(node?.id)) {
              node.setSelected(true);
            }
          });
        }
        else if (pageContext.context.selectedRows.length === rowData.length) {
          this.gridApi.selectAll();
        }
        else {
          this.gridApi.selectAll();
          this.gridApi?.gridOptionsWrapper.gridOptions.api.forEachNode(node => {
            if (!pageContext.context.selectedRows.includes(node?.id)) {
              node.setSelected(false);
            }
          });
        }
        // Retain filter state for click-throughs
        if(pageContext?.context?.filterState){
          this.gridApi.setFilterModel(pageContext.context.filterState);
        }
        this.gridApi.ensureIndexVisible(pageContext.context.navigatedRowIndex, 'middle');
      }
      setPageContext(pageName, null);
    }
  }

  renderTransionModal = () => {
    const { transitionModalConfig } = this.props;
    if(!transitionModalConfig){
      return null;
    }
    return (
    <MSTransitionModal
      deadlineStatus={transitionModalConfig.deadlineStatus}
      fixedCommentStatus={transitionModalConfig.fixedCommentStatus}
      commentStatus={transitionModalConfig.commentStatus}
      fixedComments={transitionModalConfig.fixedComments}
      onClose={transitionModalConfig?.onClose}
      onSubmit={transitionModalConfig?.onSubmit}
      show={transitionModalConfig?.showTransitionModal}
    />);
  }

  renderCopyRowWarningModal = () => (
    <MSPromptModal
      show={this.state.showCopyWarning}
      onReply={this.toggleCopyWarningModal}
      prompt="Can not copy pending changes"
      yes="Dismiss"
    />
  );

  statusBar = () => {
    const statusPanels = [];

    if (this.props.statusBarConfiguration?.showTotalAndFilteredRowCount) {
      statusPanels.push({
        statusPanel: 'agTotalAndFilteredRowCountComponent',
        align: 'left',
        key: 'agTotalAndFilteredCountKey'
      });
    }
    if (this.props.statusBarConfiguration?.showStatusBarWarning) {
      statusPanels.push({
        statusPanel: 'rowCountWarning',
        align: 'left',
        key: 'rowCountWarningKey',
      });
    }
    if (this.props.statusBarConfiguration?.showSelectedRowCount) {
      statusPanels.push({
        statusPanel: 'agSelectedRowCountComponent',
        align: 'left',
        key: 'agSelectedRowCountKey'
      });
    }
    if (this.props.statusBarConfiguration?.showAggregationComponent) {
      statusPanels.push({
        statusPanel: 'agAggregationComponent',
        key: 'agAgregationKey',
      });
    }
    return {
      statusPanels
    };
  }

  getRowStyles = (param) => {
    if (param?.data?.recordType === RECORD_TYPE.EXISTING_DELETED || param?.data?.pendingActionStatus === PENDING_ACTION_STATUS.DELETE) {
      return {
        'background-color': this.props.theme?.backgrounds?.rowDeleted || '#FDEAEC',
        'cursor': 'not-allowed'
      };
    }
    if (!isRowEditable(param.data, this.props?.dataviewModel) && this.props.shouldStyleUneditableRows) {
      return {
        'background-color': this.props.theme?.backgrounds?.septenary || '#F3F4F6',
        'cursor': 'not-allowed'
      };
    }
    return null;
  }

  tabToNextCell = (params) => {
    const result = {
      rowIndex: params.nextCellPosition?.rowIndex || params.previousCellPosition?.rowIndex,
      column: params.nextCellPosition?.column || params.previousCellPosition?.column,
    };
    if (params.nextCellPosition?.column?.colDef?.fieldType === 'TEXT_AREA') {
      result.column.colDef = {
        editable: false,
      };
    }
    // console.log('tabToNextCell params = ', params, 'tabToNextCell result = ', result);
    return result;
  }

  getDefaultColumnDefs = ()=>{
    return {...this.state.defaultColDef, suppressColumnMenu: this.props.suppressColumnMenu, filter: !this.props.disableColumnFilter};
  }
  renderGrid(){

    return (<AgGridReact
            modules={AllModules}
            columnDefs={this.state.columnDefs}
            rowData={this.state.rowData}
            defaultColDef={this.getDefaultColumnDefs()}
            // rowModelType={this.state.rowModelType}
            onGridReady={this.onGridReady}
            // multiSortKey={this.state.multiSortKey}
            overlayLoadingTemplate={this.state.overlayLoadingTemplate}
            cacheBlockSize={this.props.maxRowCount}
            maxBlocksInCache={this.state.maxBlocksInCache}
            rowSelection={this.state.rowSelection}
            animateRows={true}
            rowGroupPanelShow={this.props.rowGroupPanelShow || this.state.rowGroupPanelShow}
            frameworkComponents={this.state.frameworkComponents}
            onColumnResized={this.onColumnResizeEvent}
            getRowHeight={this.getRowHeight}
            onSortChanged={this.onSortChanged}
            onSelectionChanged={this.onSelectionChanged}
            getRowNodeId={this.getRowNodeId}
            tabToNextCell={this.tabToNextCell}
            suppressKeyboardEvent={this.state.suppressKeyboardEvent}
            rowBuffer = {this.props.rowBuffer} // Used rowBuffer as it is affecting rowSpannig in AuditHistory mmodel
            // suppressMaxRenderedRowRestriction={forExport ? true : false}

            // groupMultiAutoColumn={true}
            treeData={!!this.state.treeData}
            autoGroupColumnDef={this.state.autoGroupColumnDef}
            getDataPath={this.state.getDataPath}
            // isServerSideGroup={this.state.isServerSideGroup}
            // getServerSideGroupKey={this.state.getServerSideGroupKey}
            // onCellDoubleClicked={this.onCellDoubleClicked}
            getContextMenuItems={this.getContextMenuItems}
            getMainMenuItems={this.getMainMenuItems}
            onFirstDataRendered={this.firstDataRendered}
            // debug={true} // Enable this only for debugging purpose.

            // removing this doesn't help with losing focus while tabbing open-for-editing cells
            onCellFocused={e => {
              if (e?.column?.colDef?.fieldType !== 'ROW_SELECTION'){
                e.api.gridOptionsWrapper.gridOptions.suppressRowClickSelection = true;
              }
              else {
                e.api.gridOptionsWrapper.gridOptions.suppressRowClickSelection = false;
              }
            }}
            enableRangeSelection={true}
            /// experiment
            statusBar={this.props.statusBarConfiguration && this.state.statusBar} // To disable statusbar in auditHistory Model
            getRowStyle= {!this.props.isRowStylesDisabled && this.getRowStyles} // To disable rowStyles in auditHistory Model
            rowClassRules = {
            !this.props.isRowStylesDisabled && {
              'ag-row-selected': (params) => {
                // This class will be applied to all the checked rows and ellipsis clicked row
                // Note - not all rows displayed by MGTable will have a pcontrol_id,
                // eg process status - be careful
                const selectedNodeId = this.selectedNode?.data?.[this.props.rowKey];
                let shouldHighlight = selectedNodeId !== undefined && selectedNodeId === params?.data?.[this.props.rowKey];
                if(!shouldHighlight){
                  const selectedNodes=this.gridApi?.getSelectedNodes();
                  shouldHighlight=selectedNodes?.find(node => {
                    return (params.data?.[this.props.rowKey] === node.data?.[this.props.rowKey]);
                  });
                }
                return !!shouldHighlight;
              }
            }
            }
            onRowSelected={this.rowSelected}
            // removing this doesn't help with losing focus while tabbing open-for-editing cells
            isRowSelectable={this.isRowSelectable}
            stopEditingWhenGridLosesFocus={true}
            suppressNoRowsOverlay={!this.props.searchTableDataFailed && true} //PWP-1698 Remove 'No rows' overlay
            postSort = {this.postSort}
            suppressRowTransform={this.props.suppressRowTransform}//Enable rowspanning
            deltaRowDataMode={true}
        />);
  }

  renderToolBar() {
    if (this.props.isToolBarDisabled && !this.props.isExportEnabled) {
      return null;
    } else if (this.props.isToolBarDisabled && this.props.isExportEnabled) {
      return (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <StyledButton
            className={'export-button'}
            onClick={this.handleExportClick}
            disabled={!this.hasData()}
          >
            <i className={'fas fa-download'} />Export
          </StyledButton>
        </div>
      );
    }
    return(
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ fontWeight: 'bold', whiteSpace: 'nowrap', fontSize: '16px', alignSelf: 'center' }}>{this.getFormattedPageTitle()}</div>
          {this.props.showActionButtons && <div style={{ marginLeft: '10px' }} className={'record-action-buttons'}>
            <StyledButton onClick={this.onAddRow} disabled={this.isAddDisabled()}><i className={'fas fa-plus'} />Add</StyledButton>
            <StyledButton onClick={this.onRemoveRow} disabled={!this.state.isDeleteActive}><i className={'fas fa-trash'} />Delete</StyledButton>
            <StyledButton onClick={this.onCopyRow} disabled={this.state.isCopyDisabled}><i className={'fas fa-copy'} />Copy</StyledButton>
            <StyledButton onClick={this.onPasteRow} disabled={this.state.isPasteDisabled}><i className={'fas fa-paste'} />Paste</StyledButton>
            <StyledButton
              onClick={this.props.handleValidation}
              disabled={this.props.saveChangesDisabled}
            >
              <i className={'fas fa-check'} />Validate
                  </StyledButton>
            <StyledAgGridSaveButton
              margin={'0px 0px 0px 10px'}
              onClick={this.handleSave}
              disabled={this.props.saveChangesDisabled}
            >
              <i
                className={'fas fa-save'}
              />
              Save
                  </StyledAgGridSaveButton>
            {/* <Button onClick={this.onCloneRow}>Clone&nbsp;<i className={'fa fa-clone'} /></Button> */}
          </div>}
        </div>
        <div>
          {this.renderDataView()}
          <StyledButton
            className={'export-button'}
            onClick={this.handleExportClick}
            disabled={!this.hasData()}
          >
            <i className={'fas fa-download'} />Export
                </StyledButton>
        </div>
      </div>
    );
  }

  hasData() {
    if(this.props.rowData && this.props.rowData.length) {
      return true;
    }
    return false;
  }

  isWarningsVisible() {
    return this.props.warningsSetup?.show;
  }

  getWarningsPopupWidth() {
    return this.isWarningsVisible()? 240 : 0;
  }

  getTableWidthInternal() {
    return 1500;
  }

  renderWarnings(warningsPopupWidth) {
    if(!this.props.warningsSetup) {
      return null;
    }
    const leftPadding = 8;
    // have to place warnings in `FixedColumnsStickyHeaderTable`
    if(!warningsPopupWidth) {
      warningsPopupWidth = 0;
    }
    const warningsPopupStyle = {
      position: 'static',
      marginLeft: 15,
      height: 'calc(100vh - 170px)',
      // maxHeight: 688,
      width: warningsPopupWidth - leftPadding - 2,
      minWidth: 300,
      overflowX: 'hide',
      overflowY: 'auto',
    };
    const warningsProps = { ...this.props.warningsSetup };
    delete warningsProps.heading;
    return(
      <MSWarnings
        heading="Hard/Soft Warnings"
        { ...warningsProps }
        style={ warningsPopupStyle }
      />
    );
  }



  isDeleteAvailable(){
    const { dataViewConfig } = this.props;
    return dataViewConfig?.deletable && (this.gridApi.getSelectedNodes().length > 0) && !this.gridApi.getSelectedNodes().some(eachRow => {
      return (eachRow?.data?.pendingChangeId> -1);
    });
  }

  getPageName() {
    return this.props.pageName || '';
  }

  getPageTitle() {
    return this.props.pageTitle ? this.props.pageTitle : startCase(this.getPageName());
  }

  getFormattedPageTitle(){
    const pageTitle = this.getPageTitle();
    const {tableDescription} = this.props;
    if(pageTitle && tableDescription){
      return `${pageTitle}: ${tableDescription}`;
    }
    if(pageTitle){
      return pageTitle;
    }
    return tableDescription;
  }

  isAddDisabled() {
    const { dataViewConfig } = this.props;
    return !(dataViewConfig ?.appendable) || this.state?.selectedRows?.length > 500;
  }

  getColumnKeys(){
    const cols = this.gridColumnApi.getAllDisplayedColumns();
    const colsToExport = [];
    let temp='';
    for(let c=0;c<cols.length;c++) {
      temp = cols[c].colDef.fieldType;
      if(temp!=='ROW_SELECTION' && temp!=='CONTEXT_MENU'){
        colsToExport.push(cols[c].colDef.fieldName);
      }
    }
    return colsToExport;
  }
  getFileName(){
    switch(this.props.pageName){
    case processingStatusPage:
      return `${processingStatusPage}_${format(new Date(), 'yyyyMMMdd_HHmmss')}.csv`;
    default:
      return `${this.props.tableCode}.csv`; // For worktables feature
    }
  }
  shouldRowBeSkipped = (params) => {
    if (this.props.pageName === processingStatusPage) {
      return false;
    }
    return params?.node?.data?.recordType === 'NEW'; // For worktables feature
  }
  handleExportClick = () => {
    const columnKeys = this.getColumnKeys();
    const exportParams = {
      fileName: this.getFileName(),
      columnKeys,
      shouldRowBeSkipped: this.shouldRowBeSkipped,
      processCellCallback: (params) => {
        const rendererType = params?.column?.colDef?.rendererType;
        const param = params;
        let value = '';
        if(param.column.colDef.fieldName === this.props.rowKey){
          value = formatRowKeyForNewRow(param);
        }
        switch (rendererType) {
        case 'LOOKUP':
        case 'COMMON_ENTITY':
        case 'LOOKUP_VALUE':
        case 'ENUM':
        case 'WORKTABLE_COLUMN_DATA':
        case 'PRICE_RUN_TYPE':
        case 'WORKTABLE_TREE_COMBO':
        case 'PROCESSES':
        case 'COMBINE':
        case 'PROCESS_STATUS':
          value = formatLookUp({value: params?.value, colDef: params?.column?.colDef, rowData: params?.node?.data, textFormat:true});
          break;
        case 'APP_DATE_DATE_TIME':
        case 'APP_DATE_DISPLAY_DATE_TIME':
        case 'APP_DATE_DISPLAY_DATE':
        case 'APP_DATE_DATE':
        case 'DATE':
          value = FormatDateTimeFactoryAgGrid(param);
          break;
        case 'BOOLEAN':
          value = parseBool(param.value);
          break;
        case 'DECIMAL':
        case 'MONETARY':
          value = DecimalFormatter({colDef: params.column.colDef, value: param.value});
          break;
        case 'WHOLE':
          value =formatWhole(params.value, {column: params.column});
          break;
        case 'ICON':
          value = formatIconFactory(params.column)(params.val,params);
          break;
        //Display only time
        case 'APP_DATE_DISPLAY_TIME':
          value = FormatDateTimeFactoryAgGrid({ ...params, isTimeOnly: true });
          break;
        default:
          value = param.value;
          break;
        }

        if (this.props.treeDataConfig) {
          const {columnToHide} = this.props.treeDataConfig;
          if(param?.column?.colDef?.fieldName === columnToHide){
            const level = param.node.data.id.split(HIERARCHY_DELIMITER).length;
            let spaces='';
            if(level > 1){
              spaces = '    ';
            }
            for(let index=2;index<=level;index++){
              spaces=spaces+'    ';
            }
            value = `${spaces}${value}`;
          }
        }
        //value may not be always String, eg: number!
        //if(value?.startsWith('--')){
        if(value && (value+'').startsWith('--')){
          value = ' '+value; // Adding a space. If this CSV is opened using excel, its showing #NAME? instead of actual value.
        }
        return value;
      }
    };
    this.gridApi.exportDataAsCsv(exportParams);
  }

  render() {
    const warningsPopupWidth = this.getWarningsPopupWidth();
    return (
      <>
        <div style={{ display: 'flex' }}>
          <div style = {{width : '100%'}}>
            {this.renderToolBar()}
            <GridWrapper filterBarHeight={this.props.filterBarHeight} gridHeight={this.props.gridHeight} className={'ag-theme-balham'} id={this.props.id ? this.props.id + 'display-table' : 'display-table'}>
              {this.renderGrid()}
            </GridWrapper>
          </div>
          {this.renderWarnings(warningsPopupWidth)}
        </div>
        {this.renderTransionModal()}
        {this.renderCopyRowWarningModal()}
      </>
    );
  }
}

function dateKeyCreator(params) {
  return formatDateObj(params.value);
}

function dateTimeKeyCreator(params){
  return formatDateTime(params.value);
}

function timeKeyCreator(params){
  return new Date(params.value).toLocaleString('en-US', {hour12 : false}).split(',')[1];
}

function dropDownKeyCreator(colDef, params){
  const { value } = params;
  return formatLookUp({value: value, colDef: colDef, rowData: value, textFormat:true});
}

MGTable.propTypes = {
  rowKey: PropTypes.string,
  dataviewModel: PropTypes.object,
  isRowSelectable: PropTypes.func,
  allowLocalSort: PropTypes.bool,
  hideExpandAllCollapseAllMenuItems: PropTypes.bool,
  shouldStyleUneditableRows: PropTypes.bool,
};

MGTable.defaultProps = {
  rowKey: 'pcontrol_id', // '_rowIndex',
  allowLocalSort: true,
  shouldStyleUneditableRows: true,
};

export default withTheme(MGTable);
export { MGTable }; // non-themed version for test cases
