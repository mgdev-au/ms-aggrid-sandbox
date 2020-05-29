import React from 'react';
import { formatLookUp } from 'Format.js';

export default class MSAgDropdownCellRenderer extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { value, data, colDef } = this.props;
    const rowData = {...data};
    return formatLookUp({value,colDef,rowData});
  }
}
