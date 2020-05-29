import {isEmpty} from 'lodash';
import {formatOptions} from 'Format.js';
import {isColumnEditable} from 'TableUtils';
import {sortBy} from 'CommonUtil';
import {defaultOption} from 'Constants';
export const convertApiResponse = (resp, shouldStyleColumnCursors = true) => {
  resp.model?.columns.forEach(col => {
    //WSOD - ag-Grid: since v20.1, colDef.tooltip is gone, instead use colDef.tooltipValueGetter.
    if(col.tooltip){
      col._tooltip = col.tooltip;
      delete col.tooltip;
    }

    col.hide = col.hidden; // ag-gid expects "hide" - should we remove the "hidden" field?
    col.headerName = col.headerName || col.columnName;
    col.headerTooltip = col._tooltip || col.headerName;
    col.field = col.field || col.fieldName;

    // If not set, agGrid tries to autogenerate
    // If the user provides colId in the column definition, then this is used, otherwise the field is used.
    // If both coldId and field, then colId gets preference. If neither colId or field then numeric is provided.
    // Then finally the ID ensured to be unique by appending '_[n]' where n is the first positive number that allows uniqueness

    // https://www.ag-grid.com/javascript-grid-column-definitions/#column-changes
    // Comparison of column definitions is done on 1) object reference comparison and 2) column ID eg colDef.colId.
    // If either the object reference matches, or the column ID matches, then the grid treats the columns as the same column

    // In our case, the object ref won't match after a new fetch!!!
    // So agGrid thinks it is a new column, but finds there is another column with same field and adds '_1' to make it unique?!
    col.colId = col.field;
    const colWidth = col.width || col.columnWidth * 1;
    // If width is less than 80, AG-Grid is not displaying title
    // as sufficient space is NOT available.
    if(colWidth < 80){
      col.width = 80;
    }
    else{
      col.width = colWidth;
    }

    //visual indicator for non-editable columns
    if (shouldStyleColumnCursors) {
      if(!isColumnEditable(col, resp.model)){
        col.cellStyle = {
          cursor: 'not-allowed'
        };
      }
    }

    if (!isEmpty(col.children)) {
      col.children.forEach(c => {
        c.headerName = c.columnName;
        c.field = c.fieldName;
      });
    }
  });
  if (resp.rows) {
    resp.rows = resp.rows.map(row => Object.assign({}, row, {
      ...row.values,
    }));
  }
  if (resp?.model?.defaultSortColumns) {
    const agGridSortArray = resp.model.defaultSortColumns.map(
      item => convertMgSortToAgGrid(item)
    );
    resp.model.agGridDefaultSortColumns = agGridSortArray;
  }
  if(resp?.model?.availableDataViews){
    resp.model.availableDataViews = resp.model.availableDataViews.filter(dataView => dataView?.excludeFromWeb === false);
  }
  return resp;
};

// convert '+xyz' to {colId: 'xyz', sort: 'asc'}

// ag-grid multi-sort api example:
//
// var sort = [
//   {colId: 'pcontrol_id', sort: 'asc'},
//   {colId: 'p_status', sort: 'asc'}
// ];
// gridOptions.api.setSortModel(sort);

export const convertMgSortToAgGrid = (mgSort) => {
  let result = {};
  if (typeof mgSort === 'string') {
    result = {
      colId: mgSort.slice(1),
      sort: mgSort.substring(0,1) === '+' ? 'asc' : 'desc',
    };
  }
  return result;
};
const reshapeOption = (row, rendererParameter, valueField, labelField) =>{
  const option = {};
  const code = row.code;
  let description = row.desc;

    //Dave clarified that description should be stored for all LOOKUP columns, else rules etc breaks
    //Easiest way to handle above exception is to use description as code with minimal interruption to code elsewhere
    //This will now be handled by the server, so always go by code!
    // if(rendererType === 'LOOKUP' && fieldType === 'UNDEFINED'){
    //   code = description;
    // }

    //Always set code & description to keep processing of selected value by other components easier!
  option.code = code;
  option.desc = description;
    // option.description = description;
  option.rendererParameter = rendererParameter;

    // don't format lookup?
  if(rendererParameter && RegExp( ['code','desc','description'].join('|'),'ig').test(rendererParameter)){
    description = formatOptions(option, rendererParameter);
  }

    //props as required by respective renderer widget
  option[valueField] = option.code;
  option[labelField] = description;
  return option;
};
// This function converts API response to widget format
// formatType = 1  -> {value, label}
// formatType = 2  -> {code, displayValue}
export const convertDropdownResponse = (resp, column = {}, formatType = 1) => {
  if(isEmpty(resp)){
    return [];
  }
  if(!Array.isArray(resp)){//TreeComboData
    const result = {};
    Object.entries(resp).forEach(([key, _options]) => {
      result[key] = convertDropdownResponse(_options,column,formatType);
    });
    return result;
  }
  const { rendererParameter } = column;
  let valueField = 'value';
  let labelField = 'label';
  if(formatType === 2){
    valueField = 'code';
    labelField = 'displayValue';
  }
  if(resp[0]?.hasOwnProperty('code')){
    const options = [];
    resp.forEach(row => {
      const option = reshapeOption(row, rendererParameter, valueField, labelField);
      options.push(option);
    });
    // sortBy from lodash won't work, we need to ignore case
    // return sortBy(options, [labelField]);
    sortBy(options, 'desc', true);
    if(!column.mandatory){
      return [defaultOption,...options];
    }
    return options;
  }
  return resp;
};

export const sanitizeColumn = column => {
  if(column.endsWith('_1')){
    console.warn('sanitizeColumn(): agGrid has messed up column id - ', column);
  }
  return column?.replace('_1', '');
};

export function formatOptionsResponseWRTEntityType(options, entityType){
  const newOptions = options.options;
  const selectedEntityType = entityType?.toLowerCase();
  if(newOptions){
    const keys = Object.keys(newOptions);
    keys.forEach(x=>
    {
      if(!isEmpty(newOptions) && !(selectedEntityType === 'all')){
        newOptions[x] = newOptions[x].filter(status => {
          return !status?.hasOwnProperty('active') || (status.active) === (selectedEntityType === 'active');
        });
      }
    }
    );
  }
  options.options = newOptions;
  return options;
}
