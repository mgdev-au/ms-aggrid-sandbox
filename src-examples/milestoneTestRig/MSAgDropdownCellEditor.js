import React from 'react';
import Select, { createFilter } from 'react-select';
import { List } from 'react-virtualized';
import _ from 'lodash';
// import { sanitizeColumn } from 'AgGridUtil.js';

// import styled from 'styled-components';

export default class MSAgDropdownCellEditor extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      isLoading: true,
      menuIsOpen: false,
    };
    this.onChange = this.onChange.bind(this);
    this.getValue = this.getValue.bind(this);
  }

  componentDidMount() {
    // const colId = sanitizeColumn(this.props.column.getColId());
    colId = this.props.column.getColId();
    this.props.getDropdownOptions(colId, data => {
      const defaultValue = data?.find(d => d.label === this.props.value);
      this.setState({
        data,
        defaultValue,
        isLoading: false,
        menuIsOpen: true,
      });
      this.ref?.select?.focus();
    });
  }

  afterGuiAttached() {
    // this.ref.select.focus();
    console.log('afterGuiAttached - setting focus');
  }

  onClick(e) {
    // e.preventDefault();
    // e.stopPropagation();
    // if (!this.state.menuIsOpen && !this.state.isLoading) {
    //   this.setState({
    //     menuIsOpen: true,
    //   });
    // }
  }

  getValue() {
    let result = this.props.value;
    if (this.state.selectedOption) {
      //return object, but just what is required - {code, desc}
      result = {
        code: this.state.selectedOption.code,
        desc: this.state.selectedOption.desc,
      };
    }
    return result;
  }

  onChange(data, action) {
    if (action.action === 'select-option') {
      this.setState({
        selectedOption: data,
      });
    }
  }

  _renderMenu = params => props => <MenuList {...props} {...params} />;

  scrollToSelectedOption(ref) {
    const options= this.state.data;
    if (ref.select) {
      const selectedOption = !(this.state?.selectedOption === undefined && this.state?.defaultValue === undefined)? options.find(option => option.value === (this.state?.selectedOption?.value || this.state?.defaultValue?.value)) : -1;
      // const ref = this.ref;
      // setTimeout(() => {
      //   ref.select.scrollToFocusedOptionOnUpdate = true;
      //   ref.select.setState({
      //     focusedOption: selectedOption
      //   });
      // }, 0);
    }
  }

  render() {
    const options= this.state.data;
    const ref = this.ref;
    return (
      <Select
        ref={_ref => this.ref = _ref}
        className={'basic-single'}
        classNamePrefix={'select'}
        name={this.props.column.getColId()}
        isSearchable
        defaultMenuIsOpen={true}
        onInputChange={this.handleInputChange}
        onChange={this.onChange}
        value={this.state.selectedOption || this.state.defaultValue}
        defaultValue={this.state.defaultValue}
        options={options}
        isLoading={this.state.isLoading}
        // Setting isDisabled during fetch makes sense (to prevent focuing on
        // the field during fetch) but it prevents tabbing "through" the field
        // during fetch. Since only MGTable uses this component, at present,
        // this might be an acceptable compromise.
        // isDisabled={this.state.isLoading}
        autoSize={false}
        filterOption={createFilter({ignoreAccents: false})}
        placeholder={'Search...'}
        components={{
          MenuList: this._renderMenu({isLoading:this.state.isLoading, selectRef:ref}),
          //  MenuList: (props)=> <MenuList {...props} isLoading={this.state.isLoading} width={200}/>
        }}
        onMenuOpen={this.scrollToSelectedOption.bind(this,ref)}
      />
    );
  }
}


export class MenuList extends React.PureComponent {
  rows = {};
  state = {
    scrollToIndex: -1,
  };
  static defaultProps = {
    maxMenuHeight:210,
    optionHeight:35,
  }
  _calculateListHeight = ({ options }) => {
    const { maxMenuHeight } = this.props;

    let height = 0;

    for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
      const option = options[optionIndex];

      height += this._getOptionHeight({ option });

      if (height > maxMenuHeight) {
        return maxMenuHeight;
      }
    }

    return height;
  };

  _getOptionHeight = ({ option }) => {
    const { optionHeight } = this.props;

    return optionHeight instanceof Function
      ? optionHeight({ option })
      : optionHeight;
  };
  componentDidMount(){
    this.props?.selectRef?.onMenuOpen?.();
  }

  componentDidUpdate() {
    let scrollToIndex = -1;

    // Search the small collection of virtualized rows first.
    const lastFocusedIndex = _.reduce(
      this.rows,
      (acc, row, key) => {
        if (row) {
          acc = key;
        }
        return acc;
      },
      -1
    );
    // If we are going from the last to the first element ( or vise versa) the
    // small collection of virtualized rows will not have the last focused index.
    // Must search all children in this case.
    if (lastFocusedIndex === -1) {
      scrollToIndex = _.findLastIndex(
        this.props.children,
        child => child.props.isFocused
      );
    } else {
      scrollToIndex = lastFocusedIndex;
    }

    // Only update state if we have changed our scrollToIndex.
    if (scrollToIndex > -1 && scrollToIndex !== this.state.scrollToIndex) {
      this.setState({
        scrollToIndex
      });
    }
    this.rows = {};
  }

  render() {
    const rows = _.isArray(this.props.children) ? this.props.children : [];

    const rowRenderer = menuChildren => props => {
      this.rows[props.index] = menuChildren[props.index].props.isFocused;
      return (
        <div key={props.key} style={props.style}>
          {rows[props.index]}
        </div>
      );
    };

    return (
      <List
        style={{ display: this.props.isLoading ? 'none' : 'block', boxShadow: '0 0 0 1px hsla(0,0%,0%,0.1), 0 4px 11px hsla(0,0%,0%,0.1)' }}
        width={900}
        height={this._calculateListHeight({
          options: this.props.options
        })}
        rowHeight={({ index }) =>
          this._getOptionHeight({
            option: this.props.options[index]
          })
        }
        overscanRowCount={10}
        rowCount={rows.length}
        rowRenderer={rowRenderer(this.props.children)}
        scrollToIndex={this.state.scrollToIndex}
      />
    );
  }
}

