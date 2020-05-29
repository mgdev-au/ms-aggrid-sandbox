import React from 'react';
import moment from 'moment';
import styled from 'styled-components';

import {qa0,} from 'QAUtil.js';
import MSGlyphicon from 'MSGlyphicon/MSGlyphicon.js';
import MSProgressBar from 'MSProgressBar/MSProgressBar.js';
import MSStatusBar from 'MSStatusBar/MSStatusBar.js';
import {StyledHierarchyCellContent, StyledTruncatedText} from 'Styled/StyledComponents.js';
import {formatStatusStreamCommentFactory} from 'MSFormatStatusStream/MSFormatStatusStream.js';
import {format,} from 'date-fns';
import {getIconFromConfiguration,} from 'Actions.js';
import {formatTextAreaFactory,} from 'MSFormatTextArea/MSFormatTextArea.js';

import {isDropdownType, isEditable, isEmpty, isFromDate, isFromUTCDateTime,} from './Check.js';
import {isObject} from 'lodash';
import {getSLAStatus, getSLAStatusColor} from './SLAUtils.js';
import {truncateStyle,} from 'mixins.js';
import NumberFormat from './NumberFormat';
import {RECORD_TYPE} from 'API/API.js';
import {formatTime, isNullOrUndefined, parseTime, toISOString} from './CommonUtil.js';

export const momentDateFormat = 'DD[-]MMM[-]YYYY';
export const momentDateTimeFormat = 'DD[-]MMM[-]YYYY HH[:]mm[:]ss';
export const momentTimeFormat = 'HH:mm:ss';

export const UIDateFormat = 'DD-MMM-YYYY';

const ToleranceBreach=styled.div`
  background-color: ${({theme})=>theme.backgrounds.toleranceBreach};
  padding: 5px;
  border-radius: 4px;
  text-align:center;
`;

export function commafy(num) {
  if(isEmpty(num)){
    return num;
  }
  return num.toString().replace(/(\d)(?=(\d{3})+$)/g, '$1,');
}

export function formatDate(s) {
  if(isEmpty(s)){
    return null;
  }
  return moment.utc(s).local().format(momentDateFormat);
}

export function formatDateObj(date, formatStr) {
  if(isEmpty(date)){
    return null;
  }
  let _date=date;
  //If date is of type 20181115213415908, format returns 'Invalid Date', so trim off the time field
  if(typeof _date === 'string' && _date.length>8){
    _date=_date.slice(0,8);
  }
  return format(_date, formatStr || 'dd-MMM-yyyy');
}

/**
 * format date string `2018-06-12` to `12-Jun-2018`
 * @param {string} str the date string
 * Note: this function is used as table cell formatter and additional args are passed in
 * @returns {string} formatted result
 */
export function formatDateStr(str) {
  // use date-fns to format date
  // @see https://stackoverflow.com/questions/48172772/time-zone-issue-involving-date-fns-format
  const dt = new Date(str);
  // Why do we do this?!
  const dtDateOnly = new Date(dt.valueOf() + dt.getTimezoneOffset() * 60 * 1000);
  const rlt = format(dtDateOnly,'dd-MMM-yyyy');
  return rlt;
}

export function formatDropdownTypeFactory(lookup) {
  return function(val) {
    return lookup[val] || '';
  };
}

export function formatBooleanFactory(onChange /* optional */) {
  const fmt = function(val, obj) {
    const checked = (val === 'true' || val === true);
    return(
      <input
        type="checkbox"
        disabled = {!isEditable(obj)} // Using disabled to avoid tabing instead of tabindex -1
        checked={checked}
        onChange={e => {
          if(!isEditable(obj)) {
            // do nothing
            return;
          }
          if(onChange && typeof onChange === 'function') {
            onChange(val, obj, e.target.checked);
          }
        }}
      />
    );
  };
  fmt._uid = 'formatTextArea';
  return fmt;
}

export function formatDateTime(s) {
  return s ? moment.utc(s).local().format(momentDateTimeFormat) : null;
}

export function formatNull(s) {
  if(isObject(s)){ //Return blank if no proper rendererType set for this value! Also returning object breaks React render
    return '';
  }
  return !s || (s.match && s.match('_addRowId')) ? '' : s;
}

export function formatEnum(s) {
  return s === 'MINUS' ? '-' : (s === 'PLUS' ? '+' : formatNull(s));
}

// In Process Dashboard 'Fund Summary Table' same column shows ProgressBar or StatusBar depending on whether it is a fund group
// Fund Group -> ProgressBar, Single Fund -> StatusBar
// NOTE: make sure 'isGroup' is exposed via rowData in generateRows()
export function formatMultiple(s, obj) {
  const {column, rowData} = obj;
  // Show progress bar for both group and pool with children
  if(rowData.isGroup){
    return formatProgressBar(s, obj);
  }else if(rowData[column.fieldName + '_Status']){
    return formatStatusBar(s, obj);
  }
  return formatNull(s, obj);
}

// For applying render parameter to dropdown options label/displayValue
export function formatOptions(option, renderParameter) {
  if (!option) {
    return '';
  }
  if (!renderParameter) {
    return option.desc;
  }
  let result = renderParameter.replace(/Code/gi,option.code);
  result = result.replace(/Description/gi,option.desc);
  return result;
}
function getValueFromRow(s, rowData, fieldName, objectKey ,keys){
  if(s?.hasOwnProperty(objectKey)){
    return s[objectKey];
  }else if(rowData[fieldName]?.hasOwnProperty(objectKey)){
    return rowData[fieldName][objectKey];
  }
  let result = null;
  for(let i=0; i<keys.length; i++){
    if(rowData?.hasOwnProperty(keys[i])){
      result = rowData[keys[i]];
      break;
    }
  }
  return result;
}

export function formatCommonEntity(col, config = {}) {
  const { textFormat } = config;
  //PR-5111 As per David no longer read from pageDefaults
  // let { commonEntityRenderFormat:rendererParameter } = config;
  // if(!commonEntityRenderFormat){
  //   rendererParameter = col.rendererParameter;
  // }
  const fmt = function(s, obj) {
    try{
      const { column, rowData } = obj;
      if (isNullOrUndefined(s) || !column || !rowData) {
        return '';
      }
      const {fieldName, rendererParameter} = column;
      const code = getValueFromRow(s, rowData, fieldName, 'code',[fieldName + '_entityCode', fieldName + '_code']);
      const desc = getValueFromRow(s, rowData, fieldName, 'desc',[fieldName + '_entityDesc', fieldName + '_desc']);
      const isValidRenderer = RegExp( ['code','desc','description'].join('|'),'ig').test(rendererParameter);
      if(!rendererParameter || !isValidRenderer){
        return !isNullOrUndefined(desc)?desc : s; //because if no renderer parameter we are showing desc in dropdownoptions
      }
      if(isNullOrUndefined(code) && isNullOrUndefined(desc) ){
        return s;//PIP-8126
      }
      const style = {
        textOverflow: 'ellipsis',
        overflow: 'hidden',
      };
      const singleLineStyle = (value) => {
        return <div title={value} style={style}>{value}</div>;
      };
      const result = formatOptions({code, desc}, rendererParameter);
      if(obj.forExport || obj.textFormat || textFormat){
        return result;
      }
      return singleLineStyle(result);
    }
    catch(e){
      console.error(e);
      return s;
    }
  };
  return fmt;
}

export function formatCombine(s, obj) {
  const { column, rowData } = obj;
  if (isNullOrUndefined(s) || !column || !rowData) {
    return '';
  }
  const {fieldName, rendererParameter} = column;
  const code = getValueFromRow(s, rowData, fieldName, 'code',[fieldName + '_entityCode', fieldName + '_code']);
  const desc = getValueFromRow(s, rowData, fieldName, 'desc',[fieldName + '_entityDesc', fieldName + '_desc']);
  const isValidRenderer = RegExp( ['code','desc','description'].join('|'),'ig').test(rendererParameter);
  if(!rendererParameter || !isValidRenderer){
    return !isNullOrUndefined(desc)?desc : s; //because if no renderer parameter we are showing desc in dropdownoptions
  }
  if(isNullOrUndefined(code) && isNullOrUndefined(desc) ){
    return '';
  }
  const style = {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  };
  const singleLineStyle = (value) => {
    return <div title={value} style={style}>{value}</div>;
  };
  const dualLineStyle = (value1, value2) => {
    return (
      <div style={{ paddingRight: '10px' }}>
        <div title={value1} style={style}><strong >{value1}</strong></div>
        <div title={value2} style={style}>{value2}</div>
      </div>
    );
  };
  switch (column.rendererParameter ?.toLowerCase()) {
  case 'code': return singleLineStyle(code);
  case 'description': return singleLineStyle(desc);
  case 'code (description)': return dualLineStyle(code, desc);
  case 'description (code)': return dualLineStyle(desc, code);
  default: return dualLineStyle(code, desc);
  }
}

// TODO - temp fix just for GenericTable use, as it can't handle multiline - different row heights when pinned
export function formatCombineInSingleLine(s, obj) {
  const { column, rowData } = obj;
  if (isNullOrUndefined(s) || !column || !rowData) {
    return '';
  }
  const {fieldName, rendererParameter} = column;
  const code = getValueFromRow(s, rowData, fieldName, 'code',[fieldName + '_entityCode', fieldName + '_code']);
  const desc = getValueFromRow(s, rowData, fieldName, 'desc',[fieldName + '_entityDesc', fieldName + '_desc']);
  const isValidRenderer = RegExp( ['code','desc','description'].join('|'),'ig').test(rendererParameter);
  if(!rendererParameter || !isValidRenderer){
    return !isNullOrUndefined(desc)?desc : s; //because if no renderer parameter we are showing desc in dropdownoptions
  }
  if(isNullOrUndefined(code) && isNullOrUndefined(desc) ){
    return '';
  }
  const style = {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  };
  const singleValueStyle = (value) => {
    return <div title={value} style={style}>{value}</div>;
  };
  const dualValueStyle = (value1, value2) => {
    return (
      <div style={style}>
        <span title={value1} style={{ paddingRight: '4px' }}><strong >{value1}</strong></span>
        <span title={value2}>{value2}</span>
      </div>
    );
  };
  switch (column.rendererParameter ?.toLowerCase()) {
  case 'code': return singleValueStyle(code);
  case 'description': return singleValueStyle(desc);
  case 'code (description)': return dualValueStyle(code, desc);
  case 'description (code)': return dualValueStyle(desc, code);
  default: return dualValueStyle(code, desc);
  }
}

export function formatTolerance(val,obj){
  const {rowData,column}=obj;
  const categoryCodeRegex= new RegExp(/^(.*?)(?:[$:])/);
  const match = categoryCodeRegex.exec(
    column.fieldName.replace('x-UnitPriceExtensions-', '')
  );
  const categoryCode=match && match.length > 0 ? match[1] : '';
  const value=getRowValueForCol(column.fieldName,rowData);
  if(!categoryCode){
    return formatDecimal(val,obj);
  }
  const toleranceLevel=getRowValueForCol(
    `x-UnitPriceExtensions-${categoryCode}:TOLERANCE`
    ,rowData
  );
  const summaryToleranceLevel=getRowValueForCol(
    `x-UnitPriceExtensions-${categoryCode}:SUMMARY_TOLERANCE`
    ,rowData
  );
  if((toleranceLevel>0 || summaryToleranceLevel>0) && value>=0){
    return(
      <ToleranceBreach title={value}>
        {formatDecimal(val,obj)}
      </ToleranceBreach>
    );
  }
  return formatDecimal(val,obj);
}

function getRowValueForCol(fieldName, rowData) {
  return rowData[fieldName];
}

export function formatProgressBar(s, obj) {
  const {column, rowData} = obj;
  let totalColor;

  if(rowData._skipRender){
    return null;
  }

  const completedColor = getSLAStatusColor('COMPLETED', column);

  if (column.slaOffset) {
    totalColor = getSLAStatusColor(getSLAStatus(rowData[column.fieldName]?.minStateDateTime, column.slaOffset), column);
  }
  // else if(rowData[column.fieldName + '_Status']){
  // Get default Status Grey, even if no Status
  else {
    totalColor = getSLAStatusColor('DEFAULT', column);
  }

  return (<MSProgressBar
    column={column}
    completedColor = {completedColor}
    totalColor = {totalColor}
    completed={rowData[column.fieldName]?.completedCount}
    total={rowData[column.fieldName]?.count}
    rowData={rowData}
    linkedUrl={column.linkedUrl}
    onClick={column.cell.onClick}
    barheight={rowData.progressbarHeight}
  />);
}

export function formatStatusBar(s, obj) {
  const {column, rowData} = obj;

  if(rowData._skipRender){
    return null;
  }

  const completedColor = getSLAStatusColor('COMPLETED', column);
  let label, barColor;
  if (rowData.isFund && !rowData.isGroup) {
    if (rowData[column.fieldName]) {
      label = rowData[column.fieldName];
    } else if (rowData[column.fieldName]?.completedCount !== rowData[column.fieldName]?.count) {
      label = 'In Progress';
    }
  }

  if (column.slaOffset) {
    barColor = getSLAStatusColor(getSLAStatus(rowData[column.fieldName]?.minStateDateTime, column.slaOffset), column);
  } else {
    barColor = getSLAStatusColor('DEFAULT', column);
  }


  return (<MSStatusBar
    rowData={rowData}
    column={column}
    completed={rowData[column.fieldName]?.completedCount}
    total={rowData[column.fieldName]?.count}
    label={label}
    barColor={barColor}
    completedColor={completedColor}
    linkedUrl={column.linkedUrl}
    onClick={column.cell.onClick}
  />);
}

export function formatSlaStatus(s, obj) {
  if (!obj || !s) {
    return s || null;
  }

  const { column, rowData } = obj;

  if(rowData._skipRender){
    return null;
  }

  const statusValue = getSLAStatus(s, column.slaOffset);
  const statusColor = getSLAStatusColor(statusValue, column);
  const slaValue = formatDateObj(
    new Date(s), //convert from ISO8601 UTC DateString to local date
    'HH:mm dd-MMM'
  );

  if (statusColor) {
    return (
      <StyledTruncatedText
        width={118}
        title={slaValue}
      >
        <MSGlyphicon glyph={'fa fa-circle'} style={{color:statusColor, marginRight: 6}} />
        {slaValue}
      </StyledTruncatedText>
    );
  }
  return slaValue || null;
}

/**
 * Use the rendererParameter to find the "units mask"(C, %, asbp)
 * @param {number} s passed to reactuablar
 * @param {string} rendererParameter columns[i].rendererParameter
 * @return {string} masked number as string
 */
export function applyUnitMask(s, rendererParameter) {
  const mask = rendererParameter.includes('c') ? 'c' : (rendererParameter.includes('%') ? '%' : 'asbp');
  let number;
  if (mask === 'c' || mask === '%') {
    number = s * 100;
  } else {
    number = s * 10000;
  }
  const str = rendererParameter.split('.');
  const floatingPointPrecision = str[1].slice(0, str[1].indexOf(mask));
  number = number.toFixed(floatingPointPrecision.length);
  if (mask === '%') {
    number += '%';
  }
  return number;
}

// TODO - change the signature of all the formatters to (string, rendererParameter)
// Reason: the formatters shouldn't have to know about column structure
export function formatDecimal(s, obj) {
  const {column={}, rowData={}} = obj;
  let {rendererParameter} = column;
  const {formatOverrides} = column;
  if(formatOverrides && Array.isArray(formatOverrides) && formatOverrides.length){
    const a = formatOverrides.find(({columnFieldNames,rowMatchFieldName,rowMatchFieldValue,})=>{
      return rowData[rowMatchFieldName] === rowMatchFieldValue && columnFieldNames.includes(column.fieldName);
    });
    if(a){
      rendererParameter = a.columnFieldFormat;
    }
  }
  try{
    if(isEmpty(s)) {
      return '';
    }
    if(typeof s === 'string') {
      if(s.match(/_addRowId|_pending/)) {
        return '';
      }
      if(s === 'loading') {
        return s;
      }
      if(!isNaN(parseFloat(s))){
        s = parseFloat(s);
      } else{
        return s;
      }
    }
    if (!rendererParameter || rendererParameter === '#') {
      return s;
    }
    rendererParameter = rendererParameter.toLowerCase();
    if(/c|%|asbp/.test(rendererParameter)) {
      s = applyUnitMask(s, rendererParameter);
    }
    else{
      const floatingPointPrecision = rendererParameter.split('.');
      const maxFloatingPointPrecision = isEmpty(floatingPointPrecision[1]) ? 0 : floatingPointPrecision[1].length;
      s = s.toFixed(maxFloatingPointPrecision);
    }
    const str = s.toString().split('.');
    if (rendererParameter.includes(',')) {
      str[0] = commafy(str[0]);
    }
    return str.join('.');
  }
  catch(err){
    console.error(err);
    return s;
  }
}

export class FormatDecimalAgGrid extends React.Component {
  render() {
    const {
      value,
      column
    } = this.props;
    const rendererParameter = column?.getColDef();
    // let s = value;
    return formatDecimal(value, {column:{rendererParameter}});
  }
}

export function DecimalSetter(params) {
  if (params.newValue === params.oldValue) {
    return true;
  }
  if (isEmpty(params.newValue)) {
    params.data[params.colDef.field] = null;
    return true;
  }
  const mask = params.colDef.editorParameter || params.colDef.rendererParameter;
  let replaceMoneySign = '';
  let value = '';
  if (mask.substring(0, 1) !== '#') {
    replaceMoneySign = mask.substring(0, 1);
    value = params.newValue.replace(replaceMoneySign, '').replace(',', '') * 1;
  } else {
    value = params.newValue.replace(',', '') * 1;
  }
  if (mask?.indexOf('.0') > -1 && value !== undefined) {
    const floatingPointPrecision = mask ? mask.split('.') : [];
    const maxFloatingPointPrecision = isEmpty(floatingPointPrecision[1]) ? 0 : floatingPointPrecision[1].length;
    params.data[params.colDef.field] = (value.toFixed(maxFloatingPointPrecision)) * 1;
    return true;
  }
  params.data[params.colDef.field] = value;
  return true;
}

// Might be worth noting this will fail with ##,###asbp.  You need the '.' even
// if you dont want a mantissa.  e.g. This one works: ##,###.asbp and will
// format 123.45 to 1234500 (no decimal point)
export function DecimalFormatter(params) {
  if (isEmpty(params.value)) {
    return null;
  }
  let rendererParameter = params?.colDef?.rendererParameter;
  if (!rendererParameter || rendererParameter === '#') {
    return params.value;
  }
  rendererParameter = rendererParameter.toLowerCase();
  if(/c|%|asbp/.test(rendererParameter)) {
    const s = applyUnitMask(params.value, rendererParameter);
    const str = s.toString().split('.');
    if (rendererParameter.includes(',')) {
      str[0] = commafy(str[0]);
    }
    return str.join('.');
  }
  return NumberFormat(params.colDef.rendererParameter, params.value);
}

export function formatWhole(s, obj) {
  let rendererParameter = obj && obj.column.rendererParameter;
  if(isEmpty(s)) {
    return '';
  }
  if (!rendererParameter || rendererParameter === '#') {
    return s && s.toString();
  }
  rendererParameter = rendererParameter.toLowerCase();
  let hasMask = false;
  if (rendererParameter.includes('c') || rendererParameter.includes('%') || rendererParameter.includes('asbp')) {
    s = applyUnitMask(s, rendererParameter);//@see PCS-14110 for more info about the "Units Mask"
    hasMask = true;
  }
  if (rendererParameter.includes(',') && !hasMask) {
    return commafy(s);
  }
  return s.toString();
}

export class FormatWholeAgGrid extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    const { value, useFormattedValue, valueFormatted, column} = this.props;
    const s = useFormattedValue? valueFormatted: value;
    return formatWhole(s,{column});
  }
}

const flexmixin = () => {
  return `
    width: inherit;   //span width in table header is larger than its parent div. This is hidiing sort icon while resizing a column
    flex: 1; /* auto grow the text label */
    padding-right: 2px;
    display: flex;
    justify-content: space-between;
  `;
};
const inlineBlockMixin = (width) =>{
  return `
    width: ${width};
    display: 'inline-block';
  `;
};
const StyledDiv = styled.div`
  ${({flexlayout, width}) => {
    return flexlayout ? `${flexmixin()};` : `${inlineBlockMixin(width)};`;
  }}
  ${({onChange,theme})=> onChange && `
    cursor: pointer;
    &:hover {
      .newExpandIcon {
        color: ${theme.foregrounds.primary};
      }
    }
  `}
`;

const StyledMSGlyphicon = styled(MSGlyphicon)`
  ${({ flexLayout, float, marginRight }) => !flexLayout && `
      float: ${float};
      margin-right: ${marginRight};
      position: relative;
      top: 4;
  `}
  ${({ newExpandIcon, theme }) => newExpandIcon && `
      font-size : 1.2em;
      color : ${theme.foregrounds.quinary};
      &:hover {
        cursor: pointer;
        color: ${theme.foregrounds.primary};
      }
  `}
  ${({ flexLayout }) => flexLayout && `
      position: relative;
      display: flex;
      flex-direction: column;
      padding-top: 3px;
      padding-right: 6px;
  `}
`;

const StyledSpan = styled.span`
  ${({ flexLayout, width, left }) => !flexLayout && `
      width : ${width};
      left: ${left};
      position: relative;
      top: 4;
  `}
  ${truncateStyle('inline-block')};
`;
/**
 * Display text and an caret-down/up icon to signify more visible stuff below current row
 * @param {Number} width column width
 * icon, or else show `caret-up` icon
 * @param {Object} config OPTIONAL setup like (all attributes of setup is optional)
 * { onChange: newValue => true,
 *   textFormatter: (val, obj) => '',
 *   testIcon: (val, obj) => true,
 *   caretUpProperty: '_isExpanded',
 * }.
 * @returns {Object} formatted truncated line
 */
export function formatExpandBelowCurrentRowFactory(width, config = {}) {
  const {
    textFormatter,
    onChange,
    testIcon, // dynamically find icon using callback
    caretUpProperty,
    caretIconAtLeftSide,
    leftIndentFunction,
    newExpandIcon,
    showLabel,
  } = config;
  const fmt = function (val, obj) {
    const cellPaddingTotal = 8;
    const hasIcon = !testIcon ? true : testIcon(val, obj);
    // Different width would mess up column alignment
    // const iconWidth = hasIcon ? 8 : 0;
    const iconWidth = 16;
    const valueToDisplay = textFormatter? textFormatter(val, obj) : val;
    // just show some icons in pending row, extra wrapper around icons complicates things
    if(obj.rowData._isExpandedChildRow) {
      return valueToDisplay;
    }
    const blockProps = {
      width: width - cellPaddingTotal,
    };

    let icon = null;
    if(hasIcon) {
      const isCaretUp = obj.rowData[caretUpProperty];
      icon = (
        <StyledMSGlyphicon
          float= {caretIconAtLeftSide ? 'left' : 'right'}
          marginRight= {caretIconAtLeftSide ? 8 : 0}
          newExpandIcon={newExpandIcon}
          className={ newExpandIcon ? 'newExpandIcon': 'expandIcon'}
          flexLayout={showLabel}
          glyph={isCaretUp ? (newExpandIcon? 'caret-square-up' : 'caret-up') : (newExpandIcon ? 'caret-square-down' : 'caret-down')}
          title={isCaretUp ? 'Collapse' : 'Expand'}
        />
      );

      if(onChange) {
        blockProps.onClick = e => {
          e.stopPropagation();
          e.preventDefault();
          onChange(val, obj, !isCaretUp);
        };
      }
    }

    return (
      <StyledDiv
        flexlayout={showLabel}
        onChange={onChange}
        {...blockProps}
      >
        { caretIconAtLeftSide ? icon : null }
        <StyledSpan
          flexLayout={showLabel}
          title={typeof valueToDisplay === 'string' ? valueToDisplay : null}
          width={width - cellPaddingTotal - iconWidth}
          left={leftIndentFunction ? leftIndentFunction(val, obj) : 0}
        >
          {valueToDisplay}
          {showLabel && val}
        </StyledSpan>
        { caretIconAtLeftSide ? null : icon}
      </StyledDiv>
    );
  };
  // `_uid` should be `formatTextArea`  or else `GenericTable` will wrap another text area formatter around it
  fmt._uid = 'formatTextArea';
  return fmt;
}

export function formatIconFactory(col, config = {}) {
  const {tableName, columnWidth, getIcon,} = config;
  const fmt = function(val, obj) {
    if(getIcon) {
      return getIcon(val, obj) || '';
    }
    // val can be empty, eg: when status is Complete no SLA
    // No val throws error in getIconFromConfiguration
    if(isNullOrUndefined(val)) {
      return '';
    }
    // Check the rendererParameter for icon(for demo Invesco)
    return getIconFromConfiguration(
      isEmpty(col.rendererParameter) ? col.identifier : col.rendererParameter,
      val,
      obj,
      tableName,
      columnWidth || col.width
    ) || '';
  };
  fmt._uid = 'formatTextArea';
  return fmt;
}

export class FormatIconFactoryAgGrid extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { column, value, data} = this.props;
    // factory just returns a formatter function, but AGGrid wants formatted value
    return formatIconFactory(column?.colDef, this.props)(value, data);
  }
}

// https://stackoverflow.com/a/149099
export function formatMoney(n) {
  const c = 2,
        t = ',',
        s = n < 0 ? '-' : '',
        i = String(parseInt(n = Math.abs(Number(n) || 0).toFixed(c), 10));
  let j = i.length;
  j = j > 3 ? j % 3 : 0;
  return s + (j ? i.substr(0, j) + t : '') + i.substr(j).replace(/(\d{3})(?=\d)/g, '$1' + t) + (c ? '.' + Math.abs(n - i).toFixed(c).slice(2) : '');
}

export function formatDateTimeFactory(col, noUTC) {
  const pattern = col.rendererParameter;
  return function (s) {
    if (!s) {
      return '';
    }
    if (isEmpty(pattern) || pattern === '') {
      return moment.utc(s).local().format(momentDateTimeFormat);
    }
    const str = pattern.toString().split(' ');
    for (let i = 0; i < str.length; ++i) {
      // replace API date/time pattern with moment pattern
      str[i] = str[i]
        .replace('dd', 'DD')
        .replace('yyyy', 'YYYY')
        .replace('yy', 'YY')
        .replace('a', 'A')
        .replace('EEE', 'ddd')
        .replace('MMMMM', 'MMMM');
    }
    const newStr = str.join(' ');
    return noUTC ? moment(s).format(newStr.toString()) : moment.utc(s).local().format(newStr.toString());
  };
}

export function sanitizeDate(value, rendererType){
  if(!value){
    return value;
  }
  let rlt = value + ''; //make sure string before calling string functions
  if(rendererType === 'APP_DATE_DISPLAY_DATE' && rlt.length > 8) { //should be YYYYMMDD
    rlt = rlt.slice(0,8);
  }
  return rlt;
}

// prepare data for server API format
export function prepareDateTimeFactoryAgGrid(params){
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

export function FormatDateTimeFactoryAgGrid(params) {
  const { column, noUTC = true, isTimeOnly = false } = params;
  let { value } = params;
  const {
    // rendererParameter,
    rendererType
  } = column.colDef;
  if (!value) {
    return '';
  }

  value = sanitizeDate(value, rendererType);
  if(isTimeOnly){
    value = parseTime(value);
  }

  // This would strip out time from datetime
  // else {
  //   value = moment(value, serverDateFormat);
  // }

  const dateTimeFormatter = formatDateTimeFactory(
    column?.colDef, // formatters shouldn't have to know about column structure.
    noUTC
  );
  return dateTimeFormatter(value);
}

function toggleRoutine (e) {
  e.stopPropagation();
  e.preventDefault();
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  }
  return true;
}

// Forked version of treetabular toggleChildren function, with some customised changes in styling
export function formatExpandableFactory({toggleShowingChildren, idField = 'id', parentField = 'parent', showIcon=false},) {
  qa0(toggleShowingChildren);
  qa0(idField);
  qa0(parentField);

  return (val, obj) => {
    const {rowData, } = obj;
    const {_rowIndex, _level, _hasChildren, showingChildren,} = rowData;
    const index = _rowIndex;
    // all those things should be calculated outside for formatter, so we an do further optimization
    const iconMargin = 6;
    let icon = _hasChildren ? (
      <MSGlyphicon
        faFamily="fas"
        glyph={showingChildren ? 'caret-down' : 'caret-right'}
        title={showingChildren ? 'Collapse' : 'Expand'}
        style={{marginRight: iconMargin, width: '8px'}} //keep width consistent as 8 across expand/collapse icons for intendation calc
        onClick={e => toggleRoutine(e) && toggleShowingChildren(index)}
      />
    ) : null;
    icon = showIcon && !_hasChildren && val ? (
      <MSGlyphicon
        faFamily="fas"
        glyph={'circle'}
        title={rowData?.groupName}
        style={{color: rowData.backgroundColor, marginRight: '3px'}}
      />
    ): icon ;
    let iconWidth = 8; // use icon width as basic unit for indention because BA asked us to align text
    if(showIcon){
      iconWidth = 4;
    }
    return (
      <StyledHierarchyCellContent
        indentLeft={_level * (iconWidth + iconMargin) + (_hasChildren?0:(iconWidth + iconMargin))} //add icon size even if not shown
        onClick={e => toggleRoutine(e) && toggleShowingChildren(index)}
      >
        {icon}
        {<StyledTruncatedText title={val} width={showIcon ? '100%': null} style={showIcon ? {textAlign: 'left'}: null}>
          {val}
        </StyledTruncatedText>}
      </StyledHierarchyCellContent>
    );
  };
}

/**
 * Guess cell formatter.
 * @param {Object} col the column data from raw backend response
 * @param {Object} config OPITONAL extra data passed to formatter
 * @returns {Number} the formatter of table cell, `formatNull` is default
 */
export function guessTableCellFormatter(col, config /* optional */) {
  let theFormatter;
  let textIsTruncated = false;
  if(col.fieldType === 'STATUS_STREAM'){
    theFormatter = formatStatusStreamCommentFactory(config && config.columnWidth);
    textIsTruncated = true;
  } else if (col.fieldType === 'TEXT_AREA') {
    theFormatter = formatTextAreaFactory(config && config.columnWidth, {
      onChange: config && config.onChange,
    });
    textIsTruncated = true;
  } else if (col.fieldType === 'MULTIPLE_TYPES') {
    theFormatter = formatMultiple;
  } else if((col.rendererType === 'COMBINE')) {
    formatCombine._uid = 'combine';
    theFormatter = formatCombine;
  } else if (col.rendererType === 'SLA_DATE_TIME') {
    theFormatter = formatSlaStatus;
  } else if(isFromUTCDateTime(col)) {
    theFormatter = formatDateTimeFactory(col, true);
  } else if(isFromDate(col)) {
    theFormatter = formatDateTimeFactory(col, true);
  } else if (col.rendererType === 'BOOLEAN') {
    theFormatter = formatBooleanFactory(config && config.onChange);
    textIsTruncated = true;
  } else if (col.rendererType === 'UNIT_PRICE') {
    theFormatter = formatMoney;
  } else if (col.rendererType === 'DECIMAL') {
    theFormatter = formatDecimal;
  } else if (col.rendererType === 'WHOLE') {
    theFormatter = formatWhole;
  } else if (col.rendererType === 'ICON') {
    theFormatter = formatIconFactory(col, config);
    textIsTruncated = true;
  } else if (col.rendererType === 'ENUM') {
    theFormatter = formatEnum;
  } else if (col.rendererType === 'PROGRESS_BAR' || col.rendererType === 'PROGRESS_BAR_PERCENT') {
    theFormatter = formatProgressBar;
  } else if (col.rendererType === 'STATUS_BAR') {
    theFormatter = formatStatusBar;
  } else if (isDropdownType(col.rendererType)) {
    theFormatter = formatCommonEntity(col,config);
    // theFormatter = formatTextAreaFactory(config && config.columnWidth, {noExpandIcon: true,});
    // textIsTruncated = true;
  } else {
    theFormatter = formatNull;
  }
  if(col.style){
    theFormatter=guessTableCellFormatterStyle(col,theFormatter);
  }
  return config && config.alwaysTruncateText && !textIsTruncated ? formatTextAreaFactory(config && config.columnWidth, {
    noExpandIcon: true,
    textFormatter: theFormatter,
  }) : theFormatter;
}

export function guessTableCellFormatterStyle(col,defaultFormatter){
  if((col.style==='summary_tolerance_breach' || col.style==='tolerance_breach')&& (col.rendererType === 'DECIMAL')){
    return formatTolerance;
  }
  return defaultFormatter;
}

export function formatRowKeyForNewRow(params){
  return params?.data?.recordType===RECORD_TYPE.NEW ? '' : params.value;
}

// 3, 4, 0 -> 0003
export function padStart(value, length, padder){
  padder = padder || '0';
  value = value + '';
  return value.length >= length ? value : new Array(length - value.length + 1).join(padder) + value;
}

export function formatLookUp(config = {}) {
  const {value, colDef, rowData, textFormat = false} = config;
  let rlt = value || null;

  // handle object value from dropdown editor - {code, desc}
  // renderer gets the value directly from editor, even before cellValueChanged callback
  if (value?.code) {
    rlt = value.desc;
  }

  if (colDef?.rendererParameter) {
    rlt = formatCommonEntity(colDef)(value, { column: colDef, rowData: rowData, textFormat: textFormat});
  }
  return rlt || null;
}
