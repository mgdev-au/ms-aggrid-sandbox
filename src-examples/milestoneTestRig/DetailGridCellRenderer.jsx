import React, { Component } from 'react';
import { AgGridReact } from '@ag-grid-community/react';
import { AllModules } from '@ag-grid-enterprise/all-modules';
import { Tabs, Tab } from 'react-bootstrap'

import '@ag-grid-community/all-modules/dist/styles/ag-grid.css';
import '@ag-grid-community/all-modules/dist/styles/ag-theme-balham.css';
import 'bootstrap/dist/css/bootstrap.min.css';

export default class DetailGridCellRenderer extends Component {
  constructor(props) {
    super(props);

    this.state = {
      name: props.data.name,
      account: props.data.account,
      colDefs: [
        { field: 'callId' },
        { field: 'direction' },
        { field: 'number' },
        { field: 'duration', valueFormatter: "x.toLocaleString() + 's'" },
        { field: 'switchCode' },
      ],
      defaultColDef: {
        flex: 1,
        minWidth: 150,
      },
      rowData: props.data.callRecords,
      key:"summary",
      firstRecord: props.data.callRecords[0],
    };

    this.state.rowId = props.node.id;
    this.state.masterGridApi = props.api;
  }

  renderTabContents(key){
    console.log('renderTabContents called....', key);
    if(key === 'summary') {
      return (
        <AgGridReact
          id="detailGrid"
          class="full-width-grid ag-theme-balham"
          columnDefs={this.state.colDefs}
          defaultColDef={this.state.defaultColDef}
          rowData={this.state.rowData}
          modules={AllModules}
          onGridReady={this.onGridReady}
        />);
    }else if (key === "entities"){
      return(
        <form>
          <div>
            <p>
              <label>
                Call Id:
                <br />
                <input type="text" value={this.state.firstRecord.callId} />
              </label>
            </p>
            <p>
              <label>
                Number:
                <br />
                <input type="text" value={this.state.firstRecord.number} />
              </label>
            </p>
            <p>
              <label>
                Direction:
                <br />
                <input type="text" value={this.state.firstRecord.direction} />
              </label>
            </p>
          </div>
        </form>
      );
    }
    return <p>Tab Contents for {key}</p> ;
  }

  onSelect(key){
    console.log('Selected tab: ', key);
    this.setState({key: key});
  }

  render() {
    return (
      <div className="full-width-panel">
        <Tabs
          id="controlled-tab-example"
          activeKey={this.state.key}
          mountOnEnter={true}
          unmountOnExit={false}
          onSelect={(k) => this.onSelect(k)}
        >
          <Tab eventKey="summary" title="Summary">
            {this.renderTabContents("summary")}
          </Tab>
          <Tab eventKey="entities" title="Entities">
            {this.renderTabContents("entities")}
          </Tab>
          <Tab eventKey="ids" title="IDs">
            {this.renderTabContents("ids")}
          </Tab>
        </Tabs>
      </div>
    );
  }

  onGridReady = params => {
    let gridInfo = {
      id: this.state.rowId,
      api: params.api,
      columnApi: params.columnApi,
    };

    console.log('adding detail grid info with id: ', this.state.rowId);
    this.state.masterGridApi.addDetailGridInfo(this.state.rowId, gridInfo);
  };

  componentWillUnmount = () => {
    // the detail grid is automatically destroyed as it is a React component

    console.log('removing detail grid info with id: ', this.state.rowId);
    this.state.masterGridApi.removeDetailGridInfo(this.state.rowId);
  };
}