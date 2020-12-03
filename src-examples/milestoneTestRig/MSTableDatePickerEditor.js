//Clone of MSTableDatePicker for AG Grid implementation
import React from 'react';
import moment from 'moment';
import Datetime from 'react-datetime';
import styled from 'styled-components';
import ReactDOM from 'react-dom';
import {format, toDate} from 'date-fns';
import {formatTime} from './FormatLite';

const StyledTableDatePicker= styled(Datetime)`
  width:500px;
  .form-control {
    font-size: 12px;
    padding: 5px 10px; /* same as react-bootstrap style */
    height: 30px; /* 2px border + 28px height */
    border-radius: 0;
  }
  .rdtPicker {
    //position: fixed; //not reqd when isPopup returns true
    ${({showDropdownAtTop}) => `${showDropdownAtTop?'bottom':'top'}:100%;`}
    box-shadow: 0px 6px 12px;
  }
`;


export default class MSTableDatePickerEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      // dateValue: moment().local(),
      dateValue: undefined,
      isOpen: true,
      showDropdownAtTop: false,
    };
    this.onChange = this.onChange.bind(this);
    this.onViewModeChange = this.onViewModeChange.bind(this);
    this.getValue = this.getValue.bind(this);
    this.timeValue = null;
    this.rowId = null;
    this.isPopup = this.isPopup.bind(this);
    this.prepareDateTimeFactoryAgGrid = this.prepareDateTimeFactoryAgGrid.bind(this);
  }

  onBodyScroll = (e) => {
    if (e.direction === 'vertical' || e.direction === 'horizontal') {
      // The idea of this was to close the editor on scrolling, maybe because
      // the component isn't anchored to its cell.  However doing so interfered
      // with the desire for "Excel-like" tabbing through cells open for editing.

      // Maybe neither of these play nice with tabbing through open editors,
      // but the second one is a bit less drastic.

      // this.props.api.stopEditing(); // global stopEditing
      // this.props.stopEditing(); // stopEditing just this editor
    }
  }

  componentDidMount() {
    if (this.props.value) {
      let dateValue;
      if(this.props.isTimeOnly){
        dateValue = parseTime(this.props.value);
      }else{
        dateValue = moment(this.props.value).local();
      }
      this.setState({
        dateValue: dateValue,
      });
    }
    const indexMarginWithFirstRow = this.props.rowIndex - this.props.api.getFirstDisplayedRow();//-(this.props.rowIndex>10?10:0);//default row buffer is 20
    const indexMarginWithLastRow = this.props.api.getLastDisplayedRow() - this.props.rowIndex;
    if (indexMarginWithFirstRow > indexMarginWithLastRow && indexMarginWithFirstRow > 8) {
      this.setState({
        showDropdownAtTop: true,
      });
    }
  }


  isPopup() {
    return true;
  }

  afterGuiAttached() {
    // this._input.focus();
  }

  onChange(newValue) {
    this.setState({
      dateValue: newValue,
    });
  }

  onViewModeChange(viewMode) {
    this.viewMode = viewMode;
  }
  prepareDateTimeFactoryAgGrid(params){
    const { value, isTimeOnly, valueFormat, isISOString } = params;
    let dateValue, result = value;

    if(value) {
      //stop passing around moment object!
      if (moment.isMoment(value)) {
        dateValue = value.toDate();
      }
      if (valueFormat) {
        if (isTimeOnly) {
          result = formatTime(dateValue);
        } else if (dateValue) {
          result = format(dateValue, valueFormat);
        }
      } else if (isISOString) {
        result = toISOString(dateValue);
      } else {
        result = dateValue;
      }
    }
    return result;
  }
  getValue() {
    return this.prepareDateTimeFactoryAgGrid({
      value: this.state.dateValue,
      isTimeOnly: this.props.isTimeOnly,
      valueFormat: this.props.valueFormat,
      isISOString: this.props.isISOString,
    });
  }

  render() {
    const {
      datePickerConfig = {setFocus: true, defaultValue: new Date()},
      // data,
      rowId,
      column,
      colDef,
      showDatePicker,
      showTimePicker
    } = this.props;
    const { dateValue, isOpen, showDropdownAtTop } = this.state;
    const style = {
      border: '1px solid #66afe9',
      boxShadow: 'none',
      borderRadius: 'none',
    };
    const renderInput = datePickerConfig.setFocus?
      (props) => {
        return (
          <div>
            <input autoFocus ref={c => (this._input = c)} placeholder={dateValue ? null : 'Please select...'} {...props} style={style} onKeyDown={this.keydown}/>
          </div>
        );
      }:
      (props) => {
        return (
          <div>
            <input {...props}/>
          </div>
        );
      };

    const tableName = datePickerConfig.tableName || 'WorkTable/WorkTable@PR_OUTAGE_DECLARATION';//todo
    const _uniqueId = `${tableName}_${rowId}_${column.colDef.field}`;
    if(_uniqueId !== this.rowId) {
      this.timeValue = null;
      this.rowId = _uniqueId;
    }
    const dateTimeValue = !showTimePicker ? moment(dateValue) : (this.timeValue || dateValue);
    return (
      <StyledTableDatePicker
        id={`${column.colDef.field}DatePicker`}
        key={`${_uniqueId}DatePicker`}
        renderInput={ renderInput }
        dateFormat={showDatePicker}
        timeFormat={showTimePicker} //momentTimeFormat
        value={dateTimeValue}
        onChange={this.onChange}
        open={isOpen}
        showDropdownAtTop={showDropdownAtTop}
        dateType={colDef.rendererType}
        isTimeViewMode={this.viewMode === 'time'}
        onViewModeChange={this.onViewModeChange}
        //agGrid support - all custom popup editors should set this class
        //https://www.ag-grid.com/javascript-grid-filter-component/#custom-filters-containing-a-popup-element
        className={'ag-custom-component-popup'}
        closeOnTab
      />
    );
  }
}
