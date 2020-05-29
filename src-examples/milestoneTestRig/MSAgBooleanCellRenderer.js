import React from 'react';

export default class MSAgBooleanCellRenderer extends React.Component {

  render() {
    const { value } = this.props;
    return (
      <div style={{width: '100%', textAlign: 'center'}}>
        <div> {value ? '✓' : '✕'} </div>
      </div>
    );
  }
}

 //        <i className={parseBool(value) ? 'fa fa-check' : 'fa fa-times'} />
