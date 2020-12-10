'use strict';

import React, { Component } from 'react';
// import { render } from 'react-dom';
import { AgGridReact } from '@ag-grid-community/react';
// import { ClientSideRowModelModule } from '@ag-grid-community/client-side-row-model';
// import { MenuModule } from '@ag-grid-enterprise/menu';
// import { ColumnsToolPanelModule } from '@ag-grid-enterprise/column-tool-panel';

// for enterprise features
import {AllModules} from "@ag-grid-enterprise/all-modules";

//Styles
import '@ag-grid-community/core/dist/styles/ag-grid.css';
import '@ag-grid-community/core/dist/styles/ag-theme-balham.css';
import '@ag-grid-community/all-modules/dist/styles/ag-grid.css';
import '@ag-grid-community/all-modules/dist/styles/ag-theme-balham.css';

import "./MilestoneTestRig.css";
import "./react-select.css";

import MSAgDropdownCellEditor from './MSAgDropdownCellEditorLite';
import MSAgDropdownCellRenderer from './MSAgDropdownCellRenderer';
import MSTableDatePickerEditor from './MSTableDatePickerEditor';

export default class MilestoneTestRig_2 extends Component {
  constructor(props) {
    super(props);

    this.state = {
      modules: AllModules,
      columnDefs: [
        {
          field: 'make',
          cellEditor: 'MSAgDropdownCellEditor',
          cellEditorParams: {
            getDropdownOptions: this.getDropdownOptions,
            // values: ['Porsche', 'Toyota', 'Ford', 'AAA', 'BBB', 'CCC'],
            values: [],
          },
          cellRenderer: 'MSAgDropdownCellRenderer',
          getColId: function getColId(){return 'make'},
        },          
        {
          field: 'model',
          cellEditor : 'agRichSelectCellEditor',
          cellEditorParams: {
            values: ['Celica', 'Mondeo', 'Boxter'],
          },
          cellRenderer: 'MSAgDropdownCellRenderer',
          getColId: function getColId(){return 'model'},
        },
        {
          field: 'Date',
          cellEditor: 'MSTableDatePickerEditor',
          cellEditorParams: {
            rowId: 'pControl_Id',
            showDatePicker: 'DD[-]MMM[-]YYYY',
            showTimePicker: false,
            valueFormat: 'yyyyMMdd'
          }
        },
        {
          field: 'price',
          cellEditor: 'numericCellEditor',
        },
        {
          headerName: 'Suppress Navigable',
          field: 'field5',
          suppressNavigable: true,
          minWidth: 200,
        },
        {
          headerName: 'Not Editable',
          field: 'field6',
          editable: false,
        },
      ],
      defaultColDef: {
        flex: 1,
        editable: true,
      },
      components: { 
        numericCellEditor: getNumericCellEditor(), //Plain JavaScript Editors
      },
      frameworkComponents: { 
        MSAgDropdownCellEditor, //React Editors
        MSTableDatePickerEditor,
        MSAgDropdownCellRenderer
      },
      // editType: 'fullRow',
      rowData: getRowData(),
    };
  }

  onGridReady = params => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;
  };

  onBtStopEditing = () => {
    this.gridApi.stopEditing();
  };

  onBtStartEditing = () => {
    this.gridApi.setFocusedCell(2, 'make');
    this.gridApi.startEditingCell({
      rowIndex: 2,
      colKey: 'make',
    });
  };

  getDropdownOptions = (field, callback) => 
    callback([
    {
       "value":'Porsche',
       "label":'Porsche',
       "code":'Porsche',
       "desc":'Porsche',
    },
    {
       "value":'Toyota',
       "label":'Toyota',
       "code":'Toyota',
       "desc":'Toyota',
    },
    {
       "value":'Ford',
       "label":'Ford',
       "code":'Ford',
       "desc":'Ford',
    },
    {
       "value":'AAA',
       "label":'AAA',
       "code":'AAA',
       "desc":'AAA',
    },
    {
       "value":'BBB',
       "label":'BBB',
       "code":'BBB',
       "desc":'BBB',
    },
    {
       "value":'CCC',
       "label":'CCC',
       "code":'CCC',
       "desc":'CCC',
    }            
 ]);

  render() {
    return (
      <div style={{ width: '100%', height: '100%' }} className="ag-theme-balham">
        <h1>Rich Grid with MileStone Editors Example</h1>
        <div style={{ marginBottom: '5px' }}>
          <button
            style={{ fontSize: '12px' }}
            onClick={() => this.onBtStartEditing()}
          >
            Start Editing Line 2
          </button>
          <button
            style={{ fontSize: '12px' }}
            onClick={() => this.onBtStopEditing()}
          >
            Stop Editing
          </button>
        </div>
        <div style={{ height: '800px', width: '900px' }}>
          <div
            id="myGrid"
            style={{
              height: '100%',
              width: '100%',
            }}
            className="ag-theme-alpine"
          >
            <AgGridReact
              modules={this.state.modules}
              columnDefs={this.state.columnDefs}
              defaultColDef={this.state.defaultColDef}
              editType={this.state.editType}
              rowData={this.state.rowData}
              onGridReady={this.onGridReady}
              // JavaScript components registered here
              components={this.state.components}
              // Framework components registered here
              frameworkComponents={this.state.frameworkComponents} 
            />
          </div>
        </div>
      </div>
    );
  }
}

function getRowData() {
  var rowData = [];
  for (var i = 0; i < 10; i++) {
    rowData.push({
      make: 'Toyota',
      model: 'Celica',
      // Date: new Date(),
      price: 35000 + i * 1000,
      field5: 'Sample 22',
      field6: 'Sample 23',
    });
    rowData.push({
      make: 'Ford',
      model: 'Mondeo',
      // Date: new Date(),
      price: 32000 + i * 1000,
      field5: 'Sample 24',
      field6: 'Sample 25',
    });
    rowData.push({
      make: 'Porsche',
      model: 'Boxter',
      // Date: new Date(),
      price: 72000 + i * 1000,
      field5: 'Sample 26',
      field6: 'Sample 27',
    });
  }
  return rowData;
}
function getNumericCellEditor() {
  function isCharNumeric(charStr) {
    return !!/\d/.test(charStr);
  }
  function isKeyPressedNumeric(event) {
    var charCode = getCharCodeFromEvent(event);
    var charStr = String.fromCharCode(charCode);
    return isCharNumeric(charStr);
  }
  function getCharCodeFromEvent(event) {
    event = event || window.event;
    return typeof event.which === 'undefined' ? event.keyCode : event.which;
  }
  function NumericCellEditor() {}
  NumericCellEditor.prototype.init = function(params) {
    this.focusAfterAttached = params.cellStartedEdit;
    this.eInput = document.createElement('input');
    this.eInput.style.width = '100%';
    this.eInput.style.height = '100%';
    this.eInput.value = isCharNumeric(params.charPress)
      ? params.charPress
      : params.value;
    var that = this;
    this.eInput.addEventListener('keypress', function(event) {
      if (!isKeyPressedNumeric(event)) {
        that.eInput.focus();
        if (event.preventDefault) event.preventDefault();
      }
    });
  };
  NumericCellEditor.prototype.getGui = function() {
    return this.eInput;
  };
  NumericCellEditor.prototype.afterGuiAttached = function() {
    if (this.focusAfterAttached) {
      this.eInput.focus();
      this.eInput.select();
    }
  };
  NumericCellEditor.prototype.isCancelBeforeStart = function() {
    return this.cancelBeforeStart;
  };
  NumericCellEditor.prototype.isCancelAfterEnd = function() {};
  NumericCellEditor.prototype.getValue = function() {
    return this.eInput.value;
  };
  NumericCellEditor.prototype.focusIn = function() {
    var eInput = this.getGui();
    eInput.focus();
    eInput.select();
    console.log('NumericCellEditor.focusIn()');
  };
  NumericCellEditor.prototype.focusOut = function() {
    console.log('NumericCellEditor.focusOut()');
  };
  return NumericCellEditor;
}

// render(<GridExample></GridExample>, document.querySelector('#root'));
