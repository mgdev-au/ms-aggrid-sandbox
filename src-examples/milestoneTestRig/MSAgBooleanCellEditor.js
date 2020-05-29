import React from 'react';
// import * as PropTypes from 'prop-types';

export default class MSAgBooleanCellEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      checked: false,
    };
  }

  componentDidMount() {
    const { value } = this.props;
    this.setState({
      checked: value === 'true' || value === true,
    });
  }

  getValue() { // called by ag-grid
    return this.state.checked;
  }

  focusCheckbox = (agGridParams) => {
    const ref = this.checkboxRef; // this.cellDivRef;
    if (ref) {
      console.log('focusCheckbox - focusing checkbox', ref, agGridParams);
      // event.stopPropagation();
      // setTimeout(()=>ref.focus());
      // ref.focus();
      // this.cellDivRef.focus(); // doesn't help
    }
    else {
      console.warn('focusCheckbox - called with undefined checkbox ref');
    }
    // return false; // supposedly this stops propagataion, if that's even a good idea - https://css-tricks.com/dangers-stopping-event-propagation/
  }

  blurCheckbox = (agGridParams) => {
    const ref = this.checkboxRef; // this.cellDivRef;
    if (ref) {
      setTimeout(()=>ref.blur());
    }
    else {
      console.warn('blurCheckbox - called with undefined checkbox ref');
    }
    // return false; // supposedly this stops propagataion, if that's even a good idea
  }

  afterGuiAttached = () => { // called by ag-grid
    // this.focusCheckbox();  // focuses too soon, on creation
    const that = this;
    this.props.api.addEventListener(
      'cellEditingStarted',
      (agGridParams) => {
        if (agGridParams.column.colId === that.props.column.colId) {
          console.log('afterGuiAttached - focusing checkbox', that.checkboxRef, agGridParams);
          // that.focusCheckbox(agGridParams);
        }
      },
      // 'CaptureMode' // makes the propagation (bubbling) go from outermost to target, but maybe not for an ag-grid 'event'
    );
    this.props.api.addEventListener(
      'cellEditingStopped',
      (agGridParams) => {
        if (agGridParams.column.colId === that.props.column.colId) {
          console.log('afterGuiAttached - bluring checkbox', that.checkboxRef, agGridParams);
          // that.blurCheckbox(agGridParams);
        }
      }
    );
  }

  /*
  focusIn() { // called by ag-grid only if doing a full row edit, so useless to us here
    this.focusCheckbox();
  }

  onFocus = (e) => {
    this.focusCheckbox();
  }

  onCellFocused = (e) => {
    this.focusCheckbox();
  }

  onCellEditingStarted = (e) => {
    this.focusCheckbox();
  }
  */
  render() {
    const { data, onChange, value } = this.props;
    return (
      <div
        onFocus={this.onFocus}
        style={{width: '100%', textAlign: 'center', background: 'white'}}
        ref={(ref_) => {
          if (ref_) {
            this.cellDivRef = ref_;
          }
        }}
     >
        <input
          type="checkbox"
          checked={this.state.checked}
          // autoFocus={true}
          ref={(ref_) => {
            if (ref_) {
              this.checkboxRef = ref_;
            }
          }}
          onChange={e => {
            this.setState({
              checked: !this.state.checked,
            });
            if(onChange && typeof onChange === 'function') {
              onChange(value, data, e.target.checked);
            }
          }}
          // tabIndex="-1"
        />
      </div>
    );
  }
}
