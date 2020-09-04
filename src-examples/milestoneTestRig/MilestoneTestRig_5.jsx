'use strict';

import React, { Component } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import DetailGridCellRenderer from './DetailGridCellRenderer';

// for enterprise features
import {AllModules} from "@ag-grid-enterprise/all-modules";

//Styles
import '@ag-grid-community/core/dist/styles/ag-grid.css';
import '@ag-grid-community/core/dist/styles/ag-theme-balham.css';
import '@ag-grid-community/all-modules/dist/styles/ag-grid.css';
import '@ag-grid-community/all-modules/dist/styles/ag-theme-balham.css';

import "./MilestoneTestRig.css";
import "./react-select.css";

export default class MilestoneTestRig_5 extends Component {
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
      defaultColDef: { flex: 1 },
      detailRowHeight: 310,
      detailCellRenderer: 'myDetailCellRenderer',
      frameworkComponents: { myDetailCellRenderer: DetailGridCellRenderer },
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
      'https://raw.githubusercontent.com/ag-grid/ag-grid-docs/latest/src/javascript-grid-master-detail/custom-detail-with-grid/data/data.json'
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
        <h1>Rich Grid with Master/Detail Custom</h1>
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
              masterDetail={true}
              detailRowHeight={this.state.detailRowHeight}
              detailCellRenderer={this.state.detailCellRenderer}
              frameworkComponents={this.state.frameworkComponents}
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

function getRowData() {
  const rowData = [
    {
      a1: 'level 1 - 111',
      b1: 'level 1 - 222',
      children: [
        {
          details: 'Summary',
          children: [
            {
              a3: 'level 3 - 5551',
              b3: 'level 3 - 6661',
            },
            {
              a3: 'level 3 - 5552',
              b3: 'level 3 - 6662',
            },
            {
              a3: 'level 3 - 5553',
              b3: 'level 3 - 6663',
            },
            {
              a3: 'level 3 - 5554',
              b3: 'level 3 - 6664',
            },
            {
              a3: 'level 3 - 5555',
              b3: 'level 3 - 6665',
            },
            {
              a3: 'level 3 - 5556',
              b3: 'level 3 - 6666',
            },
          ],
        },
        {
          details: 'Entities',
        },
        {
          details: 'IDs',
        },
        {
          details: 'Errors (6)',
        },
        {
          details: 'Notes (1)',
        },

      ],
    },
    {
      a1: 'level 1 - 111',
      b1: 'level 1 - 222',
      children: [
        {
          details: 'Summary',
          b2: 'Entities',
          children: [
            {
              a3: 'level 3 - 5551',
              b3: 'level 3 - 6661',
            },
            {
              a3: 'level 3 - 5552',
              b3: 'level 3 - 6662',
            },
            {
              a3: 'level 3 - 5553',
              b3: 'level 3 - 6663',
            },
            {
              a3: 'level 3 - 5554',
              b3: 'level 3 - 6664',
            },
            {
              a3: 'level 3 - 5555',
              b3: 'level 3 - 6665',
            },
            {
              a3: 'level 3 - 5556',
              b3: 'level 3 - 6666',
            },
          ],
        },
      ],
    },
  ];
  return rowData;
}

// render(<GridExample></GridExample>, document.querySelector('#root'));
