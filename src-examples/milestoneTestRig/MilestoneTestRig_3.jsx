'use strict';

import React, { Component } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
// for enterprise features
import {AllModules} from "@ag-grid-enterprise/all-modules";

//Styles
import '@ag-grid-community/core/dist/styles/ag-grid.css';
import '@ag-grid-community/core/dist/styles/ag-theme-balham.css';
import '@ag-grid-community/all-modules/dist/styles/ag-grid.css';
import '@ag-grid-community/all-modules/dist/styles/ag-theme-balham.css';

import "./MilestoneTestRig.css";
import "./react-select.css";

export default class MilestoneTestRig_3 extends Component {
  constructor(props) {
    super(props);

    this.state = {
      modules: AllModules,
      columnDefs: [
        {
          field: 'name',
          cellRenderer: 'agGroupCellRenderer',
        },
        { field: 'account' },
        { field: 'calls' },
        {
          field: 'minutes',
          valueFormatter: "x.toLocaleString() + 'm'",
        },
      ],
      defaultColDef: { flex: 1, resizable: true, },
      detailRowHeight: 200,
      // detailCellRendererParams: {
      //   detailGridOptions: {
      //     rowSelection: 'multiple',
      //     // suppressRowClickSelection: true,
      //     // enableRangeSelection: true,
      //     columnDefs: [
      //       {
      //         field: 'callId',
      //         checkboxSelection: true,
      //       },
      //       { field: 'direction' },
      //       {
      //         field: 'number',
      //         minWidth: 150,
      //       },
      //       {
      //         field: 'duration',
      //         valueFormatter: "x.toLocaleString() + 's'",
      //       },
      //       {
      //         field: 'switchCode',
      //         minWidth: 150,
      //       },
      //     ],
      //     defaultColDef: { flex: 1 },
      //   },
      //   getDetailRowData: function(params) {
      //     // params.successCallback(params.data.callRecords);
      //     setTimeout(function() {
      //       params.successCallback(params.data.callRecords);
      //     }, 1000);
      //   },
      // },
      detailCellRendererParams: function(params) {
        const res = {};
        res.getDetailRowData = function(params) {
          // params.successCallback(params.data.callRecords);
          setTimeout(function() {
            params.successCallback(params.data.callRecords);
          }, 1000);
        };
        const nameMatch =
          params.data.name === 'Mila Smith' ||
          params.data.name === 'Harper Johnson';
        res.detailGridOptions = {
          getRowNodeId: function(data) {
            return data.account;
          },
          defaultColDef: { flex: 1, resizable: true, },
        };
        if (nameMatch) {
          res.detailGridOptions.columnDefs = [{ field: 'callId' }, { field: 'number' }];
        } else {
          res.detailGridOptions.columnDefs = [
              { field: 'callId' },
              { field: 'direction' },
              {
                field: 'duration',
                valueFormatter: "x.toLocaleString() + 's'",
              },
              { field: 'switchCode' },
            ];
        }
        res.template = function (params) {
          const personName = params.data.name;
          return '<div style="height: 100%; background-color: #EDF6FF;">'
            + '  <div style="height: 10%; padding: 10px; font-weight:bold;">Name: ' + personName + '</div>'
            + '  <div ref="eDetailGrid" style="height: 90%; padding:10px"></div>'
            + '</div>';
        }
        return res;
      },
      rowData: [],
    };
  }

  onGridReady = params => {
    this.gridApi = params.api;
    this.gridColumnApi = params.columnApi;

    const httpRequest = new XMLHttpRequest();
    const updateData = data => {
      this.setState({ rowData: data });
    };

    httpRequest.open(
      'GET',
      'https://raw.githubusercontent.com/ag-grid/ag-grid-docs/latest/src/javascript-grid-master-detail/simple/data/data.json'
    );
    httpRequest.send();
    httpRequest.onreadystatechange = () => {
      if (httpRequest.readyState === 4 && httpRequest.status === 200) {
        updateData(JSON.parse(httpRequest.responseText));
      }
    };
  };



  onFirstDataRendered = params => {
    setTimeout(function() {
      params.api.getDisplayedRowAtIndex(1).setExpanded(true);
    }, 0);
  };

  render() {
    return (
      <div style={{ width: '100%', height: '100%' }} className="ag-theme-balham">
        <h1>Rich Grid with Master/Detail Row Example</h1>
        <div style={{ height: '800px', width: '900px' }}>
          <div
            id="myGrid"
            style={{
              height: '100%',
              width: '100%',
            }}
          >
            <AgGridReact
              modules={this.state.modules}
              columnDefs={this.state.columnDefs}
              defaultColDef={this.state.defaultColDef}
              // animateRows={true}
              masterDetail={true}
              keepDetailRows={true} //keep detail grid instance instead of create/destroy on open/close
              detailCellRendererParams={this.state.detailCellRendererParams}
              onGridReady={this.onGridReady}
              onFirstDataRendered={this.onFirstDataRendered.bind(this)}
              rowData={this.state.rowData}
            />
          </div>
        </div>
      </div>
    );
  }
}

// render(<GridExample></GridExample>, document.querySelector('#root'));
