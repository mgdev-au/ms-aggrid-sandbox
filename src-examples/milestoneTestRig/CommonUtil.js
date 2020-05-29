import React from 'react';
import moment from 'moment';
import queryString from 'query-string';
import {cloneDeep, find, isEqual, isNil} from 'lodash';
import {format, toDate} from 'date-fns';

import {qa, qa0} from 'QAUtil.js';
import {serverDateFormat_DateFns, typeCollections, typeTemplates} from 'API.js';
import {getValueFromCookie, getValueFromSecureStorage} from './BrowserStorage.js';
import MSGlyphicon from 'MSGlyphicon/MSGlyphicon.js';
import {messageBox} from 'SimpleModals.js';
import {
  formatExpandBelowCurrentRowFactory,
  formatMoney,
  guessTableCellFormatter,
  momentDateFormat,
  momentDateTimeFormat,
  momentTimeFormat,
  padStart,
} from './Format.js';
import {getCenteredIconLeft, hasPendingRowChildAndIsExpandable, isPendingId,} from './DualAuth.js';

import {formatMultiLinesTextFactory,} from 'MSFormatTextArea/MSFormatTextArea.js';
import {heightOptions} from 'GenericTable/GenericTable';
import {getColumnLabel, getColumnProperty,} from 'InternalUtil.js';
import {
  isArrayNullOrEmpty,
  isEditedFieldEmpty,
  isEffectiveDate,
  isEmpty,
  isEmptyObject,
  isEmptyOrZeroColumn,
  isFromDate,
  isFromTime,
  isFromUTCDateTime,
} from './Check.js';
import {getSortingColumns, getValidEntityType, updatePrimaryFilterAction,} from 'Actions.js';
import TokenStore from 'TokenStore.js';
import {filterRowsInPureJS} from 'FilterParser.js';
import {getStore,} from 'GlobalStore.js';
import history from 'BrowserHistory';
import {resetExceutionCount} from 'ExecutionCounter.js';
import {getRoutePath} from 'HttpFetch.js';
import {isSeen} from './DOMUtils.js';

import * as Sentry from '@sentry/browser';
import {serverTimeFormat_DateFns} from 'API/Constants.js';
import {OPERATOR_MAPPING} from 'Constants';

const statusColours = {
  pass: '#40AC76', //$colorFilterGreen
  warning: '#F58E32', //$colorHighlightOrange
  error: '#D02B2B', //$colorRed
};

function str2num(str) {
  // Bitwise OR, @see https://jsperf.com/best-of-string-to-number-conversion/37
  return str | 0 ;
}

function renderResponseErrors(errors) {
  if(!errors || !Array.isArray(errors) || !errors.length) {
    return null;
  }
  const style = {
    color: '#D02B2B',
  };
  return (
    <div style={style}>
      <ul>
        {errors.map((error, index) => <li key={index}>{error}</li>)}
      </ul>
    </div>
  );
}

function getRowHeight(rowHeight) {
  return rowHeight || 30;
}

function getDocumentScrollOffset() {
  const scrollLeft = document.getElementsByClassName('Main_Layout')[0].scrollTop;
  const scrollTop = document.getElementsByClassName('Main_Layout')[0].scrollTop;
  return {
    scrollLeft,
    scrollTop,
  };
}

function convertToDescriptionArray(temp, descriptionArray) {
  const cond = temp[1];
  let indx = -1;
  for (let i = 0; i <= descriptionArray.length; ++i) {
    for (const item in descriptionArray[i]) {
      if (descriptionArray[i].hasOwnProperty(item)) {
        indx = (item === cond) ? i : -1;
      }
    }
    if (indx !== -1) {
      break;
    }
  }
  if (indx !== -1) {
    const obj = descriptionArray[indx];
    obj[cond] = [...obj[cond], temp[2]];
    obj.joiner = temp[0];
    descriptionArray[indx] = obj;
  }
  else {
    descriptionArray.push({'joiner': temp[0], [temp[1]]: [temp[2]]});
  }
  return descriptionArray;
}

function processCellNewValue(obj, newValue) {
  const t = obj.column.rendererType;
  if (isFromDate(obj.column)) {
    const validDate = moment(newValue, momentDateFormat, true).isValid();
    // empty string is always fine
    if (!validDate && newValue !== '') {
      return null;
    }
    return newValue ? moment(newValue).format(momentDateFormat) : newValue;
  }
  if (isFromUTCDateTime(obj.column)) {
    const validDate = moment(newValue, momentDateTimeFormat, true).isValid();
    // empty string is always fine
    if (!validDate && newValue !== '') {
      return null;
    }
    return newValue ? moment(newValue).format(momentDateTimeFormat) : newValue;
  }
  if(isFromTime(obj.column)){
    const validDate = moment(newValue, momentTimeFormat, true).isValid();
    // empty string is always fine
    if (!validDate && newValue !== '') {
      return null;
    }
    return newValue ? moment(newValue).format(momentTimeFormat) : newValue;
  }

  if (t === 'BOOLEAN') {
    // got string from backend, and no re-shaping when rendering table
    return newValue ? 'true' : 'false';
  }
  return newValue;
}

/**
 * create filter description from filter array
 * @param {Object} value the filter operator
 * @param {Object} index the order of the filter operator
 * @param {Object} type the type of the column we are filtering
 * @returns {Object} the result description
 */
function convertToDescription(value, index, type) {
  let result;
  if (index === 0) {
    result = '';
  }
  if (index % 3 === 2) {
    result = value;
  }
  if (index % 3 === 0) {
    switch (value) {
    case '&&':
      result = 'AND';
      break;
    case '||':
      result = 'OR';
      break;
    default:
      break;
    }
  }

  if (index % 3 === 1) {
    result = OPERATOR_MAPPING[value] || '';
  }

  return result + ' ';
}

//TODO:complete the function comment
function truncateWithEllipses(text, max) {
  return text.substr(0, max - 1) + (text.length > max ? '...' : '');
}

/**
 * merging the validation result from server with the column data
 * @param {Object} validation the returned validation result from server
 * @param {Array} columns the columns array from the model
 * @returns {Object} rslt merged object of the validation data and the column data
 */
function mergeValidationResultFromServer(validation, columns) {
  const rslt = {};
  rslt.message = validation.message;
  rslt.severity = validation.severity;
  const fieldName = validation.fieldName;
  const column = columns.find(c => c.fieldName === fieldName);
  for (const field in column) {
    if (column.hasOwnProperty(field)) {
      rslt[field] = column[field];
    }
  }
  return rslt;
}

/**
 * compare mandatory column with default values and returns true if there is any data for this column in the values list
 * @param {Object} mandatoryColumn the columns array from the model
 * @param {Array} values default values from the model
 * @returns {Boolean} returns true if there is any default value for this column, otherwise returns false
 */
function compareMandatoryColumnWithValues(mandatoryColumn, values) {
  for (const field in values) {
    if (values.hasOwnProperty(field) && mandatoryColumn.fieldName === field) {
      return true;
    }
  }
  return false;
}

/**
 * compare mandatory columns with EditedColumns and default values and return list of mandatory columns which have not default value and editedValue
 * @param {Array} mandatoryColumns the columns array from the model
 * @param {Object} editedColumns the columns which has modified in local-state
 * @param {Array} values default values from the model
 * @returns {Array} the result(an array of mandatory columns which has not any data and should show as warnnings to the user)
 */
function compareMandatoryColumnsWithEditedColumns(mandatoryColumns, editedColumns, values) {
  const validationResult = [];
  for (let i = 0; i < mandatoryColumns.length; i++) {
    let flag = false;
    for (const field in editedColumns) { //compare this mandatory column with edited data which are stored in the local-state
      if (editedColumns.hasOwnProperty(field) &&
        mandatoryColumns[i] &&
        mandatoryColumns[i].fieldName === field &&
        !isEmpty(editedColumns[field]) && !isEditedFieldEmpty(mandatoryColumns[i].rendererType, editedColumns[field])) {
        flag = true;
        i++;
      }
      else if (mandatoryColumns[i] && mandatoryColumns[i].fieldName === field) {//TODO:at this stage we are checking only for TEXT objects(by Belinda J)
        validationResult.push(mandatoryColumns[i]);
      }
    }
    if (!flag) {
      const isExist = compareMandatoryColumnWithValues(mandatoryColumns[i], values); //if there is no data in the edited data, compare with the default data
      if (!isExist) {
        validationResult.push(mandatoryColumns[i]);
      }
    }
  }
  return validationResult;
}

/**
 * restructure the rows data for supporting let/right positiong and responsiveness
 * @param {Array} children the columns array from the model
 * @returns {Array} the result(an array of restructured rows)
 */
function reStructure (children){
  const leftPosition = 'LEFT';
  const rightPosition = 'RIGHT';
  const spanPosition = 'SPAN';
  const rows = [];
  let lastPosition = '';

  children.forEach((elmnt) =>{
    let rowItem = [];
    let position = elmnt.layoutPosition;
    if (elmnt.rendererType === 'TABLE' || elmnt.rendererType === 'MULTI_SELECT') {
      position = spanPosition;
    }
    if (position === leftPosition) {
      rowItem.push(...[{elmnt: elmnt, position: leftPosition}, {}]);
      rows.push(rowItem);
    } else if (lastPosition === leftPosition && position !== spanPosition) {
      rowItem = Object.assign([], rows[rows.length - 1], {1: {elmnt: elmnt, position: rightPosition}});
      rows[rows.length - 1] = rowItem;
    } else if (position === spanPosition) {
      rowItem.push(...[{elmnt: elmnt, position: spanPosition}]);
      rows.push(rowItem);
    } else {
      rowItem.push(...[{}, {elmnt: elmnt, position: rightPosition}]);
      rows.push(rowItem);
    }
    lastPosition = position;
  });
  return rows;
}

/**
 * create a list of mandatory columns from the model.columns
 * @param {Array} columns the columns array from the model
 * @returns {Array} the result(an array of mandatory columns)
 */
function extractMandatoryColumns(columns) {
  const rslt = [];
  if (isEmpty(columns)) {
    return rslt;
  }
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].mandatory) {
      rslt.push(columns[i]);
    }
  }
  return rslt;
}

function makeGroup(column, properties) {
  if (isEmpty(column.layoutPanelGroup)) {
    properties.push(column);
  } else {
    // input: a.layoutPanelGroup = 'a', b.layoutPanelGroup = 'a', c.layoutPanelGroup = 'a'
    // output: {hasGrouping: true, groupTitle: 'a', child: [a, b, c],}
    const indx = properties.findIndex(x => x.groupTitle === column.layoutPanelGroup);
    if (indx >= 0) {
      properties[indx].child.push(column);
    } else {
      const tmp = {hasGrouping: true, groupTitle: column.layoutPanelGroup, child: [column]};
      properties.push(tmp);
    }
  }
  return properties;
}

function extractRenderingPropertiesData(processEntityData, predicate) {
  const columns = processEntityData?.model?.columns;
  if (columns.length === 0) {
    return [];
  }
  let rslt = [];
  for (let i = 0; i < columns.length; i++) {
    if(predicate(columns[i])) {
      rslt = makeGroup(columns[i], rslt);
    }
  }
  return rslt;
}

//TODO:complete the function comment
function extractParentAndChild(layoutPage, layoutSubpage, nodes) {
  const newNodes = nodes;
  if (newNodes && newNodes.length === 0) {
    newNodes.push({
      'root': layoutPage,
      'child': !isEmpty(layoutSubpage) ? [layoutSubpage] : [],
    });
    return newNodes;
  }

  const indx = newNodes.findIndex(n => n.root === layoutPage);
  if (indx !== -1) {
    if (!isEmpty(layoutSubpage) && layoutSubpage !== '') {
      const children = newNodes[indx].child;
      const location = children.findIndex(n => n === layoutSubpage);
      if (location === -1) {
        const tmp = newNodes[indx].child;
        tmp.push(layoutSubpage);
        newNodes[indx].child = tmp;
      }
    }
  } else {
    newNodes.push({
      'root': layoutPage,
      'child': !isEmpty(layoutSubpage) ? [layoutSubpage] : [],
    });
  }
  return newNodes;
}

//TODO:complete the function comment
function extractTreeNodes(treeData, layoutPagesToRemove=[]) {
  const columns = treeData && treeData.model && treeData.model.columns;
  let nodes = [];
  for (let i = 0; i < columns.length; i++) {
    if (!isEmpty(columns[i].layoutPage) && !layoutPagesToRemove.includes(columns[i].layoutPage)) {
      nodes = extractParentAndChild(columns[i].layoutPage, columns[i].layoutSubpage, nodes);
    }
  }
  return nodes;
}

//TODO:complete the function comment
function extractPinedProperties(treeData) {
  const columns = treeData && treeData.model && treeData.model.columns;
  const pinedProperties = [];
  for (let i = 0; i < columns.length; i++) {
    if (!isEmpty(columns[i].layoutPage) && columns[i].pinned === true) {
      pinedProperties.push(columns[i]);
    }
  }
  return pinedProperties;
}

function getUid() {
  return `${(new Date()).getTime()}_addRowId`;
}

//generic sortBy - any field, with or without case
function sortBy(arr, field, ignoreCase = false) {
  arr.sort(
    function (a, b) {
      let ac = a[field];
      let bc = b[field];
      if(ignoreCase){
        ac = ac.toLowerCase();
        bc = bc.toLowerCase();
      }
      if (ac === bc) {
        return 0;
      }
      return ac > bc ? 1 : -1;
    }
  );
}

function sortByDescription(arr) {
  sortBy(arr, 'description', true);
}

function isUserLoggedIn() {
  return !!getValueFromSecureStorage('token') || getValueFromCookie('AUTH_TYPE') === 'SAML';
}

function getLineCount(val, charCountInOneLine) {
  if(val.length) {
    return val.length;
  }
  const lineBreaks = val.match(/\r\n|\r|\n/g);
  const lineCount = Math.ceil(val.length / charCountInOneLine);
  return lineBreaks ? lineCount + lineBreaks.length : lineCount;
}

function spreadModelFlags (resp) {
  return {
    appendable: resp.appendable,
    editable: resp.editable,
    deletable: resp.deletable,
  };
}

function getParentTD(t) {
  const original = t;
  for ( ; t && t !== document; t = t.parentNode ) {
    if(t.localName === 'td') {
      return t;
    }
  }
  return original;
}

function getElementOffset(e) {
  const element = getParentTD(e.target);
  qa0(element.localName === 'td');
  const bodyRect = document.body.getBoundingClientRect(),
        elemRect = element.getBoundingClientRect(),
        offsetX = elemRect.left - bodyRect.left;
  const offsetY = elemRect.top - bodyRect.top - 2;
  return {
    offsetX,
    offsetY,
  };
}

function spreadRowData(obj) {
  if(!obj) {
    return obj;
  }
  const val = obj.rowData;
  return val;
}

/**
 * create front end column setup from backend response
 * @param {Object} setup front end column setup
 * @param {Object} backendColumn the column from backend response
 * @returns {Object} the updated frontend column setup
 */
function createTableColumnSetupFrom(setup, backendColumn) {
  const rlt = {
    ...backendColumn,
    property: backendColumn.fieldName,
    visible: !backendColumn.hidden,
    ...setup,
  };
  if(!rlt.header) {
    rlt.header = {};
  }
  if(!rlt.header.label) {
    rlt.header.label = backendColumn.columnName;
  }
  if(!rlt.header.formatters) {
    rlt.header.formatters = [];
  }
  if(!rlt.header.transforms) {
    rlt.header.transforms = [];
  }
  if(!rlt.cell) {
    rlt.cell = {};
  }
  if(!rlt.cell.formatters) {
    rlt.cell.formatters = [];
  }
  if(!rlt.cell.transforms) {
    rlt.cell.transforms = [];
  }
  return rlt;
}

function getColumnsTotalWidth(myCols) {
  let sum = 0;
  // sanity check
  if (!myCols) {
    return sum;
  }

  // sum of all columns width
  for (const c of myCols) {
    // `c.props.style.minWidth` could zero, see `MSWorkTableList`
    // c.width should be removed in the future. It's just workaround code for Exceptions View and FundFocus page
    const columnWidth = isEmpty(c.props?.style?.minWidth) ? parseInt(c.width, 10) /* c.width should be removed. It's not precise */ : c.props.style.minWidth;
    sum += c.children? getColumnsTotalWidth(c.children) : columnWidth;
  }
  return sum;
}

const lineSep = / *[\r\n]+ */;

function maxLineLength(s) {
  if(!s) {
    return 0;
  }
  const lines = s.split(lineSep);
  let rlt = 0;
  // ES6 syntax, you could use Babel
  for (const l of lines) {
    if (l.length > rlt) {
      rlt = l.length;
    }
  }
  return rlt;
}

function getPrimaryContainerPadding() {
  return 15;
}

function getLeftSidebarWidth() {
  return 50;
}

// To remove empty space at the bottom of fund overview
function getLeftSidebarHeight(hasNoPrimaryFilter) {
  const height = hasNoPrimaryFilter ? 47 : 102;
  return window.innerHeight - height;
}

function getTableContainerWidth() {
  return window.innerWidth - getPrimaryContainerPadding() * 2;
}

function getTableContainerWithLeftSidebarWidth() {
  return getTableContainerWidth() - getLeftSidebarWidth();
}

function getTableContainerWithLeftSidebarWidthFromFundOverview() {
  return getTableContainerWidth() - getLeftSidebarWidth() - 35;
}

function getTopMenubarHeight() {
  return 46;
}

function getPrimaryFilterHeight() {
  return 50;
}

const FILTERBAR_HEIGHT = 160;
function estimateTableHeight(groupedColumns, filterBarHeight = FILTERBAR_HEIGHT){
  const tableHeaderHeight = estimateHeaderHeight(groupedColumns);
  let maxHeight = getTableContainerMinusPrimaryFilterHeight() - filterBarHeight - Math.max(tableHeaderHeight, ROW_HEIGHT);
  maxHeight = Math.ceil(maxHeight/ROW_HEIGHT)*ROW_HEIGHT-20;
  return maxHeight;
}

function getTableContainerMinusPrimaryFilterHeight(filterBarHeight = FILTERBAR_HEIGHT) {
  return window.innerHeight - getPrimaryFilterHeight() - getTopMenubarHeight();
}

function getTableInTabWithLeftSidebarWidth() {
  return getTableContainerWithLeftSidebarWidth() - 2;
}

function getTableWidth(tableContainerWidth) {
  return tableContainerWidth - 2; /* - 2 total border width */
}

/**
 * Converting the highLight conditions' value to appropriate type
 * convertHighLightRulesData(columns)
 * @param {Array} columns - columns from back-end
 * @returns {Array} columns- returns modified columns according to the rendererTypes
 */

function convertHighLightRulesData(columns) {
  for (let i = 0; i < columns.length; ++i) {
    if (isEmpty(columns[i].highLightRules)) {
      continue;
    }
    for (let j = 0; j < columns[i].highLightRules.length; ++j) {
      for (let k = 0; k < columns[i].highLightRules[j].conditions.length; ++k) {
        const boundPropertyName = columns[i].highLightRules[j].conditions[k].boundPropertyName;
        const columnIndex = columns.findIndex(x => x.property === boundPropertyName);
        const rendererType = (columnIndex !== -1 ? columns[columnIndex].rendererType : '');
        const value = columns[i].highLightRules[j].conditions[k].value;
        // TODO use immutability-helper for below line
        columns[i].highLightRules[j].conditions[k].value =
          (rendererType === 'DECIMAL' || rendererType === 'WHOLE') ? Number(value) : value;
      }
    }
  }
  return columns;
}

/**
 * Checks if the current column has any highLightRules
 * hasHighLightRules(col)
 * @param {Number} col - Column setup from  back end data
 * @returns {Boolean} returns 'true' if the column has defined rule/rules, otherwise returns 'false'
 */

function hasHighLightRules(col) {
  // if the column.highLightRules is not null, then this column needs be highLighted
  const rules = col.highLightRules;
  return !isEmpty(rules);
}
/**
 * Comparing the boundPropertyNameValue and  the compareValue according to the condition string
 * getConditionResult(boundPropertyNameValue, condition, value)
 * @param {Number} boundPropertyNameValue - the value of the boundPropertyName in the current row
 * @param {String} condition - the condition from back-end which we using to compare the boundPropertyNameValue and the value
 * @param {Number} compareValue - the exact value for comparing the condition
 * @returns {Boolean} returns 'true' if at least one condition inside the rules is true, otherwise returns 'false'
 */


function getConditionResult(boundPropertyNameValue, condition, compareValue){
  let rlt;
  if(isNaN(compareValue)){
    boundPropertyNameValue = boundPropertyNameValue && boundPropertyNameValue.toLowerCase();
    compareValue = compareValue && compareValue.toLowerCase();
  }
  switch (condition){
  case 'EQUALS': {
    rlt= boundPropertyNameValue === compareValue;
    break;
  }
  case 'NOT_EQUALS': {
    rlt= boundPropertyNameValue !== compareValue;
    break;
  }
  case 'GREATER_THAN': {
    rlt= boundPropertyNameValue > compareValue;
    break;
  }
  case 'GREATER_THAN_OR_EQUAL': {
    rlt= boundPropertyNameValue >= compareValue;
    break;
  }
  case 'LESS_THAN': {
    rlt= boundPropertyNameValue < compareValue;
    break;
  }
  case 'LESS_THAN_OR_EQUAL': {
    rlt= boundPropertyNameValue <= compareValue;
    break;
  }
  default:
    return null;
  }
  return rlt;
}

/**
 * Processing the rules from back-end  and return the result color for the cell's color
 * applyHighLightRules(rules, rowData)
 * @param {Object} rules - the condition's rules from back-end
 * @param {Object} rowData - the current row data
 * @returns {String} color's name for applying in the cell's border,
 * Example:
 * 'red'
 * 'green'
 * 'blue'
 */
function applyHighLightRules(rules, rowData) {
  if (isEmpty(rules)) {
    return null;
  }
  let color;
  for (const rule of rules) {
    const rlt = [];
    for (const condition of rule.conditions) {
      const boundPropertyName = condition.boundPropertyName;
      const conditionType = condition.conditionType;
      const value = condition.value;
      rlt.push(getConditionResult(rowData[boundPropertyName], conditionType, value));
    }
    if (rlt.findIndex(r => r === false) === -1) {
      color = rule.color;
      break;
    }
  }
  return color ? color : 'transparent';
}


function beforeRefresh() {
  if('production' !== process.env.NODE_ENV) {
    return;
  }
  window.onbeforeunload = function () {
    return 'This page is asking you to confirm that you want to leave - data you have entered may not be saved.';
  };
}

function beforeLogout() {
  window.onbeforeunload = null;
  resetExceutionCount();
}

function removeWhitespace(s) {
  return s.replace(/\s/g,'');
}

function validatorRequired(val) {
  return val && (val !== '');
}

function validatorAlphaNumeric(val) {
  console.log('validatorAlphaNumeric called => ', 'val=', val);
  return /^[a-zA-Z0-9]+$/.test(val);
}

function validatorDateTime(val) {
  // '10-Jan-2017 04:57:52'
  return /^[0-9]{2}-[A-Za-z]{3}-[0-9]{4}\s{1}[0-9]{2}:[0-9]{2}:[0-9]{2}$/i.test(val);
}

function parseDate(input, toUTC = false) {
  if (toUTC) {
    try {
      return moment(input, momentDateTimeFormat).toISOString();
    }
    catch (e) {
      throw new Error('Could not parse date into UTC format');
    }
  }

  // 1356354000000
  if (typeof input === 'number') {
    return moment(input);
  }

  // '2016-02-19'
  if (input.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)) {
    return moment(input, 'YYYY-MM-DD');
  }
  // '01-Dec-2016'
  if (input.match(/^[0-9]{2}-[A-Za-z]{3}-[0-9]{4}$/)) {
    return moment(input, 'DD-MMM-YYYY');
  }
  // 'Dec-01-2016'
  return moment(input).format(momentDateFormat);
}

// This function parses a time string (HHmmsssss) into JS Date
function parseTime(timeStr){
  if(!timeStr || timeStr.length < 9) {
    console.warn('parseTime(): Invalid timeStr, cannot parse time! - ', timeStr);
    return timeStr;
  }
  const date = new Date();
  //assumed timeformat - HHmmsssss
  date.setHours(
    parseInt(timeStr[0]+timeStr[1], 10), //hours
    parseInt(timeStr[2]+timeStr[3], 10), //minutes
    parseInt(timeStr[4]+timeStr[5], 10), //seconds
    parseInt(timeStr[6]+timeStr[7]+timeStr[8], 10), //milliseconds
  );
  return date;
}

// This function formats given JS Date to time string
function formatTime(date){
  //assumed timeformat - HHmmsssss
  return format(date, serverTimeFormat_DateFns);
  // return date? `${padStart(date.getHours(),2)}${padStart(date.getMinutes(),2)}${padStart(date.getSeconds(),2)}${padStart(date.getMilliseconds(),3)}` : date;
}

// We cannot use JS native functions as they include millisecs
function toISOString(dateIn){
  const date = new Date(dateIn);
  return date.getUTCFullYear() +
    '-' + padStart(date.getUTCMonth() + 1, 2) +
    '-' + padStart(date.getUTCDate(), 2) +
    'T' + padStart(date.getUTCHours(), 2) +
    ':' + padStart(date.getUTCMinutes(), 2) +
    ':' + padStart(date.getUTCSeconds(), 2) +
    'Z';
}

/*This function splits values by the agreed separator/delimiter from API*/
function parseMultiple(data){
  return data? data.split('::') : [];
}


function parseBool(input){
  return input === 'true' || input === true;
}

function parseMoney(m) {
  if (typeof m === 'number') {
    return m;
  }
  // its'a string and we have to parse it
  m = m.replace(/,|\.00$/g, '');
  console.log('parseMoney called => result=', m.match(/^[0-9]+$/) ? parseInt(m, 10) : parseFloat(m), 'm=', m);
  return m.match(/^[0-9]+$/) ? parseInt(m, 10) : parseFloat(m);
}


function convertCellDatesToUTC(rows) {
  const convertedCells = cloneDeep(rows);
  convertedCells.forEach((row) => {
    Object.keys(row.values).forEach((cell) => {
      if (moment.isMoment(row.values[cell])) {
        const toUTC = row.values[cell]._isUTC;
        row.values[cell] = parseDate(row.values[cell]._d.toString(), toUTC);
      }
    });
  });
  return convertedCells;
}

function convertRowPropertyNames(cells, tableRows, excludedFields = []) {
  const rowData = tableRows[0].values;
  return cells.filter((cell) => {
    Object.keys(cell.values).forEach((rowPropertyName) => {
      if (!excludedFields.includes(rowPropertyName) && typeof rowData[`${rowPropertyName}_code`] !== 'undefined') {
        cell.values[`${rowPropertyName}_code`] = cell.values[rowPropertyName];
        delete cell.values[rowPropertyName];
      }
    });
    return cell;
  });
}

function endsWith(str, postfix) {
  if(!str || !postfix) {
    return false;
  }
  const re = new RegExp(postfix + '$');
  return re.test(str)? true : false;
}

function stripId(id) {
  return id.replace(/:stripped:.*/g, '');
}

function cleanIdForExport(id) {
  return stripId(id.replace(/:row:/g, '-'));
}

// the columns setup passed to reactabular
/**
 * Use the property to find column index
 * if nothing find, return -1
 * @param {array} columns passed to reactuablar
 * @param {string} property columns[i].property === property
 * @return {number} column index
 */
function getColumnIndex(columns, property) {
  // {rowData, property, rowKey} = obj
  for (let i = 0; i < columns.length; i++) {
    if(columns[i].property === property) {
      return i;
    }
  }
  return -1;
}

// @see https://gist.github.com/gka/7469245
function getPreciseTextWidth(str) {
  if(!str) {
    return 0;
  }
  let w = 0;
  for(const c of str) {
    if (c === 'W' || c === 'M'){
      w += 15;
    } else if (c === 'w' || c === 'm'){
      w += 6;
    } else if (c === 'I' || c === 'i' || c === 'l' || c === 't' || c === 'f'){
      w += 4;
    } else if (c === 'r'){
      w += 6;
    } else if (c === c.toUpperCase()){
      w += 12;
    } else{
      w += 8;
    }
  }
  return w + 2;
}

/**
 * Estimate column width by counting characters in header and cell
 * Please note this function MAY scan all the cells in current column
 * to calculate the column width. So it could be SLOW. Sometimes you
 * should NOT use this function at all. For example, in `CashForecast`
 * first table. We just use a hard coded value for most columns because
 * they only contains numeric values.
 * @example
 * // 1. Get column width by counting characters in header
 * estimateColumnWidth(col);
 * // 2. Get column width from text in Header and cell
 * estimateColumnWidth(col, rows = [])
 * // 4. Get column width. Formatted text in cell is two characters longer than original text
 * estimateColumnWidth(col, rows = [], {cellWidth: str => str.length + 2 })
 * @param {Object} col - Column setup from  back end data or column setup for reactabular
 * @param {Array} rows - Rows extracted from  back end raw data, OPTIONAL, you can use null or []
 * But if no row is provided, we can only calculate the column width from column header.
 * @param {Object} config - how to estimate {cellWidth: null}, OPTIONAL.
 *  - `config.cellWidth` can be a function like `str => str.length`, the result of
 *    function execution is the cell width **measured by character number**.
 *    average character. For example, "llll" is thinner than "WWWW".
 *  - if `config.extraWidth` greater than zero, the return result will plus `config.extraWidth`.
 *    For example, the column header may contain extra menu or filter.
 * @returns {Number} Column width by calculating both header width and cell width.
 */
function estimateColumnWidth(col, rows, config = null) {
  const minColumnWidth = 80 /* at least we need be able to render one icon */;
  const padding = 12;
  const extraWidth = (config && config.extraWidth)? config.extraWidth : 0;
  const columnName = getColumnLabel(col);
  const fieldName = getColumnProperty(col);
  const isTextArea = col.fieldType && col.fieldType === 'TEXT_AREA';
  let rlt;

  if(!isEmpty(col.columnWidth)) {
    // have to re-shape data here, since backend may send string instead of number
    // in some table. @see PCS-14350
    if(typeof col.columnWidth !== 'number') {
      col.columnWidth = parseInt(col.columnWidth, 10);
    }
    // backend may send too small width like 5 pixel to frontend
    if(col.columnWidth < minColumnWidth) {
      col.columnWidth = minColumnWidth;
    }
    return col.columnWidth;
  }
  // the column width calculated from header text
  rlt = getPreciseTextWidth(columnName);
  if(rows && rows.length > 0 && !isTextArea /* meaningless to scan rows for formatTextArea*/) {
    // if rows provided, we use actual value in EACH cell
    // to calculate the column width:
    //   value = row.values[fieldName] || row[fieldName]
    let val;
    let valLength;
    let maxValLength = 0;
    let maxVal = '';
    const isMoneyCell = (config && config.cellWidth === 'money');
    const isFuncCell = (config && (typeof config.cellWidth === 'function'));
    for (const r of rows) {
      // make sure val is string
      val = `${(r.values && r.values[fieldName]) || r[fieldName] || ''}`;
      // if (col.fieldName.match(/amount/i)) {
      if (isMoneyCell) {
        valLength = formatMoney(val).length;
      } else if(isFuncCell) {
        valLength = config?.cellWidth(val);
      } else {
        valLength = val.length;
      }
      // width of biggest cell is column width
      if(valLength > maxValLength) {
        maxVal = val;
        maxValLength = valLength;
      }
    }
    if(col.allOptions && !isArrayNullOrEmpty(col.allOptions) && col.rendererType === 'LOOKUP' && maxVal){
      maxVal = col.allOptions.sort((a, b) => b.displayValue.length - a.displayValue.length)[0].displayValue;
    }

    rlt =Math.max(rlt, getPreciseTextWidth(maxVal));
  }
  return rlt + padding + extraWidth;
}


function checkExternalDateLimit({currentDate, externalDateLimit, setEntityValidCallback, validDateRangeDays, currentDateIdentifier = null}) {
  // MSDatePicker.isValidDate make invalid date un-pickable
  function dateIsValid(result) {
    if (setEntityValidCallback) {
      setEntityValidCallback(result);
    }
    return (result);
  }

  if (!currentDate._isAMomentObject || !externalDateLimit._isAMomentObject) {
    return dateIsValid(false);
  }

  if (currentDateIdentifier) {
    if (currentDateIdentifier === 'from' && currentDate.isAfter(moment(externalDateLimit), 'day')) {
      return dateIsValid(false);
    }

    if (currentDateIdentifier === 'to' && currentDate.isBefore(moment(externalDateLimit), 'day')) {
      return dateIsValid(false);
    }
  }

  if(validDateRangeDays) {
    const lessThanValidDateRange =
      currentDate.diff &&
      externalDateLimit &&
      !(Math.abs(currentDate.diff(externalDateLimit, 'days')) > validDateRangeDays);

    if (!lessThanValidDateRange) {
      return dateIsValid(false);
    }
  }
  return dateIsValid(true);
}

function windowOpenUrl(url) {
  window.open(encodeURI(url), '_blank');
}

/**
 * https://developer.mozilla.org/en-US/docs/Web/Events/resize#Examples
 * a utility function to set table container width
 * @see PCS-13944 the discussion about performance between Chen and Rowan in comments
 * @param {Object} self self.state.tableContainerWidth and self.setState() should exist
 * @param {function} fn return the table width. It's getTableContainerWidth by default
 * @returns {void}
 */
function setTableContainerWidthTimely(self, fn) {
  if(!fn) {
    fn = getTableContainerWidth;
  }
  if (!self.resizeTimeout) {
    self.resizeTimeout = setTimeout(function() {
      self.resizeTimeout = null;
      self.setState({ tableContainerWidth: fn() });
    }, 500);
  }
}

function extractInteger(s) {
  let rlt = parseInt(s, 10);
  if(!rlt) {
    rlt = 0;
  }
  return rlt;
}

function getHeaderLabelWidth(column, forceExtraControl, tableConfig) {
  const formatters = column.header.formatters;
  const fmt = formatters && formatters[0];
  let w = (fmt && fmt._uid === 'formatTableHeader') || forceExtraControl ? 40 : 0;
  //Give more width to header label if no sort or menu controls
  if(tableConfig) {
    if(!tableConfig.sortable){
      w = w - 15;
    }
    if(!tableConfig.filterable && !tableConfig.lockable) {
      w = w - 15;
    }
    if(column.layoutPageExpand){
      w = w + 15;
    }
  }
  return column.props.style.minWidth - w;
}

function guessTextAlignment(col) {
  const type = col.rendererType || col.fieldType;
  let rlt;
  switch(type) {
  case 'DECIMAL':
  case 'WHOLE':
  case 'UNIT_PRICE':
    rlt = 'right';
    break;
  case 'BOOLEAN':
    rlt = 'center';
    break;
  default:
    rlt = 'left';
    break;
  }
  return rlt;
}



function groupColumnsBy(columns, key) {
  const scale = columns.length + 1;
  const cols = [...columns],
        groupIndexDict = {}; /* { cols[0][key]: 0 */
  // try to preserver columns original order while grouping
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    const g = c[key];
    const gIndex = i * scale + 1;
    if(g) {
      // first column in the group
      if(!groupIndexDict[g]) {
        groupIndexDict[g] = gIndex;
        c._groupIndex = gIndex;
      } else {
        // other columns (except first column) in the group
        c._groupIndex = groupIndexDict[g] + i;
      }
    } else {
      c._groupIndex = gIndex;
    }
  }
  cols.sort((a,b) => a._groupIndex - b._groupIndex);
  const rlt = cols.reduce(function(sum, val) {
    const str = val[key];
    if(str && str.length && sum.old === str) {
      sum.arr[sum.arr.length-1].push(val);
    } else {
      sum.old = str;
      sum.arr.push([val]);
    }
    return sum;
  }, {old: null, arr: []});

  // group failed, meaningless to continue
  if(rlt.arr.length >= cols.length) {
    return null;
  }
  // re-shape the result
  return rlt.arr.map(function(e) {
    if(e.length > 1) {
      return {
        header: {
          label: e[0][key]
        },
        children: e
      };
    }
    return e[0];
  });
}

function retrieveStringBetweenParentheses(str){
  if(isEmpty(str)){
    return '';
  }
  if(!str.match(/\(([^)]+)\)/)) {
    return str;
  }
  return str.match(/\(([^)]+)\)/)[1];
}

function buildUrl(destination, queryParams = {}) {
  const urlParts = [
    destination.searchUrl,
    destination.searchFilter ? destination.searchFilter.replace(/(={)/gi, '{=}{') : ''
  ]
    .filter(n => n)
    .join('&')
    .split('?');
  if (queryParams.fromDate) {
    queryParams.fromDate = prepareApiDateParam(queryParams.fromDate, queryParams.dateType, true);
  }
  if (queryParams.toDate) {
    queryParams.toDate = prepareApiDateParam(queryParams.toDate, queryParams.dateType);
  }
  const urlQuery = Object.assign({}, queryString.parse(urlParts[1] || ''));
  const qs = queryString.stringify({ ...urlQuery });
  /*
  * don't encode the params as replaceUrlPlaceholders needs the unencoded chars
  */
  const fullUrl = urlParts[0] + '?' + decodeURIComponent(qs);
  const finalUrl = replaceUrlPlaceholders(fullUrl, {
    dataView: destination.dataView,
    ...queryParams,
  });
  return getRoutePath(finalUrl.replace(/({=})/gi, encodeURIComponent('{=}')));
}

function replaceUrlPlaceholders(url='', record) {
  if (url.match(/{.*?}/g) === null) {
    return url;
  }

  const notFoundParameters = [];
  const newUrl = url.match(/{.*?}/g).reduce((accumulator, currentValue) => {
    const parameterName = currentValue.replace(/{|}/g, '');
    let parameterValue = record[parameterName];

    //if date, assume PROCESSING_DATE and format accordingly
    //UI hack, as discussed with Graham and Swathi as API expects datetime for from/to Date and currently row has only date (no time)
    if(isEffectiveDate(parameterValue)){
      parameterValue = prepareApiDateParam(toDate(parameterValue), 'PROCESSING_DATE');
    }

    //Don't use _code, use _entityCode if available
    if(record[`${parameterName}_entityCode`]){
      parameterValue = record[`${parameterName}_entityCode`];
    }
    if (isNil(parameterValue)) {
      notFoundParameters.push(parameterName);
      return accumulator;
    }
    return accumulator.replace(currentValue, parameterValue);
  }, url);

  if (notFoundParameters.length) {
    console.warn(`could not find required parameters in the record: ${notFoundParameters}`);
    console.log('url:', url);
    console.log('record:', record);
    return newUrl.replace(/filter=([\w\s]+)={.*?}[&]?/g, '');
  }
  return newUrl;
}

function processNavigation(nav, contextIn){
  console.log('##### processNavigation.... nav:', nav, 'context', contextIn);
  let targetUrl = nav.linkedUrl;
  const context = {...contextIn, dataView : nav.dataView};
  //TODO add fund-overview to menu as hidden
  // if(isTargetPageAccessible(nav.linkedUrl)) {
  const searchUrl = replaceUrlPlaceholders(nav.searchUrl || '', context);
  const searchFilter = replaceUrlPlaceholders(nav.searchFilter || '', context);
  if (nav.dataView || searchUrl || searchFilter) {
    targetUrl = replaceUrlPlaceholders(targetUrl, context);
    if (targetUrl.indexOf('?') === -1) { //some links already have some params, so just add to it! eg: worktables
      targetUrl = `${targetUrl}?targetDV=${nav.dataView}&searchUrl=${encodeURIComponent(searchUrl)}&searchFilter=${encodeURIComponent(searchFilter)}`;
    } else {
      targetUrl = `${targetUrl}&targetDV=${nav.dataView}&searchUrl=${encodeURIComponent(searchUrl)}&searchFilter=${encodeURIComponent(searchFilter)}`;
    }
  }
  processClickThru(targetUrl, {}, true);
  // }else{
  // console.warn('User doesnt have access to -',targetUrl);
  // }
  return null; //for eslint
}

function navigationLookupTable(cellPropertyName, navigationDestinations, sourceTableName) {

  const node = find(navigationDestinations, {
    source: {
      sourceTableName: sourceTableName
    }
  });

  function checkContainsCellPropertyName(dest) {
    return dest.boundPropertyNames !== null ? dest.boundPropertyNames.includes(cellPropertyName) : false;
  }

  if (node) {

    //initialize highlighted tabs to false
    node.destinations.forEach(function (part, index, destinations) {
      destinations[index].highlightedTab = false;
    });

    //find cell default destination and set as highlighted tab
    const cellDefaultIndex = node.destinations.findIndex(dest => dest.navigatedFrom === 'CELL' && dest.defaultNavigation && (checkContainsCellPropertyName(dest)));
    if (cellDefaultIndex>=0) {
      node.destinations[cellDefaultIndex].highlightedTab = true;
      return {
        source: node.source,
        destinations: node.destinations
      };
    }

    //if no cell default, find cell destination and set as highlighted tab
    const cellIndex = node.destinations.findIndex(dest => dest.navigatedFrom === 'CELL' && (checkContainsCellPropertyName(dest)));
    if (cellIndex>=0) {
      node.destinations[cellIndex].highlightedTab = true;
      return {
        source: node.source,
        destinations: node.destinations
      };
    }

    //if no cell destination, find row default and set highlighted tab.
    const rowDefaultIndex = node.destinations.findIndex(dest => dest.navigatedFrom === 'ROW' && dest.defaultNavigation);
    if (rowDefaultIndex>=0) {
      node.destinations[rowDefaultIndex].highlightedTab = true;
    }else{
      console.error('navigationLookupTable: no default destination found for row level, check this against business rules');
    }

    return {
      source: node.source,
      destinations: node.destinations
    };
  }

  return null;
}

function extractBusinessObjectIds(rowsTicked, {rowData}, extractLinkedBusinessObjectId = false) {
  if (rowsTicked && rowsTicked.length) {
    return rowsTicked.map(e => extractLinkedBusinessObjectId ? e.linkedBusinessObjectId : e.businessObjectId);
  }
  return [extractLinkedBusinessObjectId ? rowData.linkedBusinessObjectId : rowData.businessObjectId];
}

/**
 *creating the sort pattern for sending to the backend API for getting the sorted data
 * @param {Object} sortingColumns an object of the columns which should be sorted according to the UI
 * @param {Boolean} formatInArray define return format
 * @param {Boolean} encodeURI whether to use encodeURIComponent method or not
 * @return {String | Array} the sort pattern for sending to the API. sample: -ID&sort=-Run+ID&sort=+Status
 * "+" / "%2B" : showing Ascending sorting
 * "-": showing Descending sorting
 */
function getSortingColumnsPattern(sortingColumns, formatInArray = false, encodeURI = true) {
  const sortingPattern = [];
  if (!isEmpty(sortingColumns)) {
    sortingColumns.sort(function (a, b) {
      return a.priority - b.priority;
    });
    for (const obj of sortingColumns) {
      //fieldName, direction, priority
      const fieldName = obj.fieldName || obj.colId;
      let filedSortType;
      if (obj.direction) {
        filedSortType = obj.direction === 'asc' ? '+' : '-';
      } else if (obj.sort) {
        filedSortType = obj.sort === 'asc' ? '+' : '-';
      }
      sortingPattern.push(encodeURI ? encodeURIComponent(filedSortType + fieldName) : filedSortType + fieldName);
    }
  }
  if (formatInArray) {
    return sortingPattern;
  }
  let sortingString = sortingPattern[0];
  for (let i = 1; i < sortingPattern.length; i++) {
    sortingString += `&sort=${sortingPattern[i]}`;
  }
  return sortingString;
}

function getSortPattern(sortingColumns, tableName) {
  const currentTableSortingColumns = sortingColumns[tableName];
  if (currentTableSortingColumns && Object.keys(currentTableSortingColumns).length) {
    return getSortingColumnsPattern(currentTableSortingColumns) || '';
  }
  return '';
}

function getSortingColumnFromObject(sortingColumns = []) {
  return sortingColumns.map(c => `${c.direction.toLowerCase === 'asc' ? '+' : '-'}${c.fieldName}`);
}

function extractDefaultSortColumns(tableData) {
  return tableData && tableData.model && tableData.model.defaultSortColumns;
}

function extractModelColumns(data) {
  return (data && data.model && data.model.columns) || [];
}

function extractVisibleColumns(data) {
  const visibleColumns = [];
  if(data?.model?.columns.length>0){
    data?.model?.columns.forEach(column => {
      if(!column.hidden){
        visibleColumns.push(column);
      }
    });
  }
  else if(data?.length>0){
    data?.forEach(column=>{
      if(!column.hidden){
        visibleColumns.push(column);
      }
    });
  }
  return visibleColumns;
}

function needProcessDefaultSortColumns (tableData) {
  if(!tableData || !tableData.rows || !tableData.rows.length || !tableData.model) {
    return false;
  }
  return extractDefaultSortColumns(tableData);
}

export function getColumnsFilter (filterOptions, tableName) {
  return (filterOptions && filterOptions[tableName]) || [];
}

function needHandleFilteringColumns (thisProps, nextProps, tableName) {
  return !isEqual(getColumnsFilter(thisProps.filterOptions, tableName),
    getColumnsFilter(nextProps.filterOptions, tableName));
}

function needHandleSortingColumns (thisProps, nextProps, tableName) {
  return !isEqual(getSortingColumns(thisProps.sortingColumns, tableName),
    getSortingColumns(nextProps.sortingColumns, tableName))
    && nextProps.sortingColumnTablesClicked[tableName];
}

function createSortingObject(defaultSortColumns, tableName, columns, rows) {
  const sortColumns = [];
  let order = 0;
  for (let i = 0; i < defaultSortColumns.length; i++) {
    const direction = defaultSortColumns[i].slice(0, 1) === '+' ? 'asc' : 'desc';
    const value = defaultSortColumns[i].slice(1);
    const columnIndex = columns.findIndex(c => c.fieldName === value);
    if (columnIndex !== -1) {
      order += 1;
      sortColumns.push(getSortColumnData(value, direction, order, tableName));
    }
  }
  const result = [];
  for (let j = 0; j < sortColumns.length; j++) {
    result.push(sortColumns[j].data[0]);
  }
  return {[tableName]: result};
}

function getSortColumnData(value, dir, priority, tableName) {
  return {
    key: tableName,
    data: [
      {
        fieldName: value,
        direction: dir,
        priority: priority
      }
    ]
  };
}

function toggleSortWithinSortList(fieldName, sortList) {
  return sortList
    .map(sortListSortString => {
      switch (sortListSortString) {
      case `+${fieldName}`:
        return `-${fieldName}`;

      case `-${fieldName}`:
        return '';
      default:
        return sortListSortString;
      }
    })
    .filter(item => !!item);
}

function createColumnSortClickHandler({column, currentSort = [], callback}) {
  return (e) => {
    e.preventDefault();
    const isCtrlClick = (e.ctrlKey || e.metaKey);
    const { fieldName } = column;
    const existingSortString = currentSort.find(currentSortString => {
      return currentSortString.includes(fieldName);
    });

    let sort;
    if (existingSortString && isCtrlClick) {
      sort = toggleSortWithinSortList(fieldName, currentSort);

    } else if (existingSortString && !isCtrlClick) {
      sort = toggleSortWithinSortList(fieldName, [existingSortString]);

    } else if (!existingSortString && isCtrlClick) {
      sort = [].concat(currentSort, [`+${fieldName}`]);

    } else {
      sort = [`+${fieldName}`];
    }

    callback({ sort });

    return true;
  };
}

/**
 * Return the part of string after a particular character
 * @param {String} text you wish to strip the substring from
 * @param {String} character you wish to use as the index of substring to be stripped after
 * @return {String} substring after split.
 * */
function getSubstringAfterCharacter(text, character){
  return text.substring(text.lastIndexOf(character) + 1);
}

/**
 * @param {Object} workTableCodes map
 * @param {String} tableName for code you are trying to match on. (after @ sign) e.g WorkTable/WorkTable/PR_VALID_PROPOSED would need PR_VALID_PROPOSED
 * @return{String} code's description for the code that matched in the map.
 */
function getWorkTableTitle(workTableCodes, tableName){
  const workTableTitle = workTableCodes[getSubstringAfterCharacter(tableName, '@')];
  if (!workTableTitle) {
    console.error(`getWorkTableTitle(): could not find worktable title for: ${tableName}`);
  }
  return workTableTitle;
}

/**
 * create new row from backend row and spread its `values` (flattenRow)
 * USAGE:
 *   assertEqual(
 *     {a:3, b:4, c: 5},
 *     newRow({c: 5, values:{a:3, b:1}}, {b:4})
 *   );
 * @param {object} row the backend row
 * @param {object} extraFields OPTIONAL data to spread
 * @returns {object} new row
 */
function newRow(row, extraFields = {} /*optional*/) {
  // already flat row
  if(!row.values) {
    return {
      ...row,
      ...extraFields,
    };
  }
  let r = {};
  for(const k of Object.keys(row)) {
    if(k === 'values') {
      continue;
    }
    r[k] = row[k];
  }
  r = {...r, ...row.values, ...row.branch, ...extraFields};
  if (!isArrayNullOrEmpty(extraFields?._changedCells)) {
    Object.keys(r).forEach(k => {
      if (row.values[k] !== undefined && !extraFields._changedCells.includes(k)) {
        r[k] = null;
      }
    });
  }
  return r;
}

function getDefaultDataViewCode(tableModel) {
  return tableModel && tableModel.code;
}

function extractDefaultDataView(tableModel) {
  if(!tableModel) {
    return null;
  }
  return {
    code: tableModel.code,
    description: tableModel.description,
  };
}

function notZeroNorUndefined(value) {
  return (value !== 0 && value !== '0') && value !== undefined;
}

// eslint-disable-next-line no-shadow
function extractZeroCellStatus(columns, rows, emptyColumnCheck = null) {
  const dict = {};
  for (const col of columns) {
    const fieldName = col.fieldName;
    const isZero = emptyColumnCheck ? emptyColumnCheck(col, rows) : isEmptyOrZeroColumn(col, rows);
    dict[fieldName] = {'_zeroFlag': isZero};
  }
  return dict;
}

function nonZeroColumns(zeroColumnsDic, columns = []) {
  const nonZeroCols=[];
  for (let i = 0; i < columns.length; i++) {
    const fieldName = columns[i].fieldName;
    if(isEmpty(zeroColumnsDic[fieldName]) || !zeroColumnsDic[fieldName]._zeroFlag) {
      nonZeroCols.push(columns[i]);
    }
  }
  return nonZeroCols;
}

function estimatePDFPageSize(cols) {
  return cols.length > 15 ? 'A0' : (cols.length > 7 ? 'A1' : 'A2');
}

function convertTableSize(size) {
  switch (size) {
  case 'small':
    return heightOptions[0];
  case 'medium':
    return heightOptions[1];
  default:
    return heightOptions[2];
  }
}

function formatSizes(sizes) {
  return sizes.split(',').map((item) => {
    return item.trim();
  });
}

function getTableSize(tableName, config) {
  if (!config || !config.pageDefaults || !config.tableNames || !config.tableNames.length) {
    return convertTableSize();
  }

  if (tableName === config.tableNames[0] && config.pageDefaults.firstPanelSizes) {
    const firstPanelSizes = formatSizes(config.pageDefaults.firstPanelSizes);
    if (Boolean(config.hasThirdTable) && firstPanelSizes[2]) {
      return convertTableSize(firstPanelSizes[2]);
    }

    if (Boolean(config.hasSecondTable) && firstPanelSizes[1]) {
      return convertTableSize(firstPanelSizes[1]);
    }

    return convertTableSize(firstPanelSizes[0]);
  }

  if (tableName === config.tableNames[1] && config.pageDefaults.secondPanelSizes) {
    const secondPanelSizes = formatSizes(config.pageDefaults.secondPanelSizes);
    if (Boolean(config.hasThirdTable) && secondPanelSizes[1]) {
      return convertTableSize(secondPanelSizes[1]);
    }
    return convertTableSize(secondPanelSizes[0]);
  }

  if (tableName === config.tableNames[2] && config.pageDefaults.thirdPanelSizes) {
    const thirdPanelSizes = formatSizes(config.pageDefaults.thirdPanelSizes);
    if (thirdPanelSizes[0]) {
      return convertTableSize(thirdPanelSizes[0]);
    }
    return convertTableSize();
  }
  return convertTableSize();
}

function getTemplateCollectionCode(templateCollectionCode){
  return templateCollectionCode && templateCollectionCode.hasOwnProperty('code') ? templateCollectionCode.code : '';
}

//returns value for given url param
function getUrlParam (url, paramName){
  if(isEmpty(paramName)) {
    return null;
  }

  const urlParams = getUrlParams(url);
  return urlParams[paramName];
}


//returns all url params and values
function getUrlParams(url) {

  // get query string from url (optional) or window
  // eslint-disable-next-line no-shadow
  let queryString = url ? url.split('?')[1] : window.location.search.slice(1);

  // we'll store the parameters here
  const obj = {};

  // if query string exists
  if (queryString) {

    // stuff after # is not part of query string, so get rid of it
    queryString = queryString.split('#')[0];

    // split our query string into its component parts
    const arr = queryString.split('&');

    for (let i=0; i<arr.length; i++) {
      // separate the keys and the values
      const a = arr[i].split('=');

      // in case params look like: list[]=thing1&list[]=thing2
      let paramNum = undefined;
      const paramName = a[0].replace(/\[\d*\]/, function(v) {
        paramNum = v.slice(1,-1);
        return '';
      });

      // set parameter value (use 'true' if empty)
      const paramValue = typeof(a[1])==='undefined' ? true : a[1];

      // // (optional) keep case consistent
      // paramName = paramName.toLowerCase();
      // paramValue = paramValue.toLowerCase();

      if (!obj[paramName]) {
        obj[paramName] = paramValue;
        continue;
      }
      // convert value to array (if still string)
      if (typeof obj[paramName] === 'string') {
        obj[paramName] = [obj[paramName]];
      }
      // if no array index number specified...
      if (typeof paramNum === 'undefined') {
        // put the value on the end of the array
        obj[paramName].push(paramValue);
      }
      // if array index number specified...
      else {
        // put the value at that index number
        obj[paramName][paramNum] = paramValue;
      }
    }
  }

  return obj;
}

function replaceOrAppendUrlParam (url, paramName, paramValue, noUrlEncode /*optional*/) {
  if(isEmpty(paramName) || isEmpty(paramValue)) {
    return url;
  }
  paramValue +=''; // convert to string
  const re = new RegExp(`${paramName}=[^=&]*`, 'g');
  // sortPattern may pass '+columnProperty'
  const urlSegment = `${paramName}=${noUrlEncode? paramValue : encodeURIComponent(paramValue)}`;
  if(!url.match(re)) {
    // append
    return `${url}&${urlSegment}`;
  }
  // replace
  return url.replace(re, urlSegment);
}

function extractActiveStatus(t) {
  qa(t);
  return t.selectedEntityType?.toUpperCase() || t.toUpperCase();
}

function prepareApiDateParam(dateObj, dateType, isFromDateVal){
  //Date format is ISO-8601: YYYY-MM-DDTHH:mm:ss.sssZ
  //Processing Date - fill with zeros
  //Run Date - local start and end of day, converted to UTC timezone
  //dateobj could be string, always convert to date object
  const dateObjClone = toDate(dateObj);
  let dateStringISO = format(dateObjClone, serverDateFormat_DateFns);
  if(dateType === 'PROCESSING_DATE'){
    dateStringISO += 'T00:00:00Z';
  }else{
    if(isFromDateVal){
      dateObjClone.setHours(0,0,0); //start of day
    }else{
      dateObjClone.setHours(23,59,59); //end of day
    }
    dateStringISO = dateObjClone.toISOString();
  }
  return dateStringISO;
}

// Used with getJSON
function prepareApiSearchParams(compState, usePlanCode = false, useTemplateCollection = true /* obsolete */, includeDateParameters = true) {
  const params = {
    dataView: compState.dataView || '',
    entitySearchType: getValidEntityType(compState.entityType?.code),
    includeChildren: !!compState.includeChildren,
    applyDefaultSorting: !!compState.applyDefaultSorting,
  };
  if(compState.pageSize){
    params.pageSize=compState.pageSize;
  }
  if (compState.filterEntityStatus?.selectedEntityType) {
    params.activeStatus = extractActiveStatus(compState.filterEntityStatus.selectedEntityType);
  }

  if (usePlanCode) {
    params.planCode = compState.entity?.code;
  } else {
    params.entityCode = compState.entity?.code;
  }

  if (includeDateParameters) {
    if(!compState?.allDateTypes?.includes(compState.dateType) && compState.defaultDateType?.code){
      params.dateType = compState.defaultDateType.code;
    } else{
      params.dateType = compState.dateType;
    }
    if (compState.entitySearchFromDate || compState.fromDate) {
      params.fromDate = prepareApiDateParam(compState.entitySearchFromDate || compState.fromDate, params.dateType , true);
    }
    if (compState.entitySearchToDate || compState.toDate) {
      params.toDate = prepareApiDateParam(compState.entitySearchToDate || compState.toDate, params.dateType );
    }
  }

  if(compState?.contextFilter?.unitPriceId){
    params.unitPriceId = compState?.contextFilter?.unitPriceId;
  }
  if(compState?.contextFilter?.entityCode){
    params.entityCode = compState?.contextFilter?.entityCode;
  }

  //this should replace above two and be more generic!
  if(compState?.contextFilter?.filters){
    params.filters = formatFilterURL(compState.contextFilter.filters);
  }
  //Here contextFilter not contains includeChildren directly, it is set in contextFilter.filterSpecification.primaryFilter
  if (compState?.contextFilter) {
    params.includeChildren = !!compState.contextFilter?.filterSpecification?.primaryFilter?.includeChildren;
  }
  const additionalParams = ['dashboard', 'stateFromDateTime', 'stateToDateTime', 'dashboard', 'filters', 'sort', 'groupFilters',];
  additionalParams.forEach(field => {
    if (!isEmptyObject(compState[field])) {
      params[field] = compState[field];
    }
  });

  if (!isEmptyObject(compState.activeFilters)) {
    params.filters = formatFilterURL(compState.activeFilters);
  }

  if (compState.groupBy) {
    params.groupBy = formatGroupByURL(compState.groupBy);
  }

  const templateCollectionCode = getTemplateCollectionCode(compState.templateCollection);
  if (compState.entityType?.code === typeTemplates) {
    params.templateCode = templateCollectionCode;
  }
  if (compState.entityType?.code === typeCollections) {
    params.collectionCode = templateCollectionCode;
  }
  return queryString.stringify(params);
}

// PCS-17882 This Method seperates URLParams and bodyParams and returns an array of URLParams and Bodyparams
export function getURLAndBodyParams(compState, usePlanCode = false, includeDateParameters = true) {
  const URLparams = {
    dataView: compState.dataView || '',
    entitySearchType: getValidEntityType(compState.entityType?.code),
    includeChildren: !!compState.includeChildren,
    applyDefaultSorting: !!compState.applyDefaultSorting,
  };
  const bodyParams = {};
  if(compState.pageSize){
    URLparams.pageSize=compState.pageSize;
  }
  if (compState.filterEntityStatus?.selectedEntityType) {
    URLparams.activeStatus = extractActiveStatus(compState.filterEntityStatus.selectedEntityType);
  }

  if (usePlanCode) {
    URLparams.planCode = compState.entity?.code;
  } else {
    URLparams.entityCode = compState.entity?.code;
  }

  if (includeDateParameters) {
    if(!compState?.allDateTypes?.includes(compState.dateType) && compState.defaultDateType?.code){
      URLparams.dateType = compState.defaultDateType.code;
    } else{
      URLparams.dateType = compState.dateType;
    }
    if (compState.entitySearchFromDate || compState.fromDate) {
      URLparams.fromDate = prepareApiDateParam(compState.entitySearchFromDate || compState.fromDate, URLparams.dateType , true);
    }
    if (compState.entitySearchToDate || compState.toDate) {
      URLparams.toDate = prepareApiDateParam(compState.entitySearchToDate || compState.toDate, URLparams.dateType );
    }
  }

  if(compState?.contextFilter?.unitPriceId){
    URLparams.unitPriceId = compState?.contextFilter?.unitPriceId;
  }
  if(compState?.contextFilter?.entityCode){
    URLparams.entityCode = compState?.contextFilter?.entityCode;
  }

  //this should replace above two and be more generic!
  if(compState?.contextFilter?.filters){
    bodyParams.filters = formatFilterURL(compState.contextFilter.filters);
  }

  if (compState?.contextFilter) {
    URLparams.includeChildren = !!compState.contextFilter?.filterSpecification?.primaryFilter?.includeChildren;
  }
  if (compState?.statusStreamName) {
    URLparams.statusStreamName = compState.statusStreamName;
  }
  let additionalParams = ['dashboard', 'stateFromDateTime', 'stateToDateTime', 'dashboard', 'sort'];
  additionalParams.forEach(field => {
    if (!isEmptyObject(compState[field])) {
      URLparams[field] = compState[field];
    }
  });
  additionalParams = ['filters', 'groupFilters', 'flowIds', 'ids'];
  additionalParams.forEach(field => {
    if (!isEmptyObject(compState[field])) {
      bodyParams[field] = compState[field];
    }
  });
  if (!isEmptyObject(compState.activeFilters)) {
    bodyParams.filters = formatFilterURL(compState.activeFilters);
  }

  if (compState.groupBy) {
    bodyParams.groupBy = formatGroupByParams(compState.groupBy);
  }

  const templateCollectionCode = getTemplateCollectionCode(compState.templateCollection);
  if (compState.entityType?.code === typeTemplates) {
    URLparams.templateCode = templateCollectionCode;
  }
  if (compState.entityType?.code === typeCollections) {
    URLparams.collectionCode = templateCollectionCode;
  }
  return [queryString.stringify(URLparams), bodyParams];
}

// Used with postJSON
function prepareApiContextFilterParams(compState) {
  if(compState.contextFilter){
    const data = compState?.contextFilter?.businessObjectIds && [...compState.contextFilter.businessObjectIds];
    return data && Array.isArray(data) ? data : null;
  }
  return null;
}

function getMultiLineColumns(columns) {
  const cols = columns.filter(c => c.cell && c.cell.isMultilineText);
  for(const c of cols) {
    if(!c.cell.formatters) {
      c.cell.formatters = [];
    }
    c.cell.formatters.push(formatMultiLinesTextFactory(c.props.style.minWidth));
  }
  return cols;
}

const ROW_HEIGHT = 40; //simple table
function estimateHeaderHeight(grouped, rowHeight = ROW_HEIGHT) {
  return grouped? (grouped.headerRows.length * rowHeight) : rowHeight;
}

function calculateRowHeight(row, multiLineColumns, rowHeight) {
  const charWidth = 6; /* half of 12px font size*/
  const theLineHeight = 16;
  const xPaddingSum = 12;
  const yPaddingSum = 12;
  if(!multiLineColumns || !multiLineColumns.length || row._collapseRow) {
    return getRowHeight(rowHeight);
  }
  let rlt = getRowHeight(rowHeight);
  for(const c of multiLineColumns) {
    const val = row[c.property];
    if(!val) {
      continue;
    }

    const charCountInOneLine = Math.floor((c.props.style.minWidth - xPaddingSum) / charWidth);
    // please note val could be array
    const lineCount = getLineCount(val, charCountInOneLine);
    if(lineCount > 1) {
      const h = lineCount * theLineHeight + yPaddingSum;
      if(h > rlt) {
        rlt = h;
      }
    }
  }
  return rlt;
}

function extractValidationData(rows, rowKey = 'id', extraFields = {}) {
  const rlt = [];
  for(const row of rows) {
    const rowKeyValue = row[rowKey] || row.values[rowKey];
    const theNewRow = {
      ...extraFields,
      [rowKey]: rowKeyValue, // sometimes backend need uid here
      classificationStaticId: row.classificationStaticId,
      originatorCode : row.originatorCode,
      integrityVersion: row.integrityVersion,
      treeIntegrityVersion: row.treeIntegrityVersion,
      values: {
        [rowKey]: rowKeyValue, // sometimes backend need uid here
        integrityValue: row.values.integrityValue,
        integrityVersion: row.values.integrityVersion,
      },
    };
    const pending = row.pendingActionStatus || row.values.pendingActionStatus;
    if(pending) {
      theNewRow.pendingActionStatus = pending;
    }
    rlt.push(theNewRow);
  }
  return rlt;
}

function containsAllowedCharacters(value) {
  return /^[a-zA-Z0-9-_ ]+$/.test(value) || value === '';
}

function iterateTree(rlt, tree, accessChildren, setOneNode) {
  if(!tree || !tree.length) {
    return;
  }
  for (const node of tree) {
    setOneNode(rlt, node);
    iterateTree(rlt, accessChildren(node), accessChildren, setOneNode);
  }
  return;
}

function stripFirstAndLastCharacter(str) {
  return str.slice(1, -1);
}

function formatFiltersArraysObject(filtersArrayObject){
  let filters = '';
  Object.keys(filtersArrayObject).map(
    filter => {
      if(Array.isArray(filtersArrayObject[filter])) {
        filtersArrayObject[filter].map(filterVal => {
          filters += `&filters=${filter}{=}${filterVal}`;
        });
      }else{
        filters += `&filters=${filter}{=}${filtersArrayObject[filter]}`;
      }
    }
  );
  // return filters;
  return encodeURI(filters); //should be encoded since adding braces - {=}
}

function formatFilterURL(activeFilters, getNameFn /* optional */) {
  if (Array.isArray(activeFilters) || typeof activeFilters === 'string' || !activeFilters) {
    return activeFilters;
  }

  //if pre-formatted 'filters' available just use that
  if(activeFilters.filters){
    return activeFilters.filters;
  }

  const filters = [];
  const inClause = '{IN}';
  const containsClause = '{CONTAINS}';
  Object.keys(activeFilters).forEach(function (key) {
    const targetFilter = activeFilters[key];
    if (targetFilter.options) {
      const filterOptions = targetFilter.options.map((option, index) => {
        return option.key;
      });
      if(targetFilter.name === 'validationTestItem' || targetFilter.name === 'validationTestItemEntity'){
        filterOptions.forEach((filterOption)=>{
          filters.push(`${getNameFn ? getNameFn(targetFilter.name) : targetFilter.name}${containsClause}${filterOption}`);
        });
      } else {
        filters.push(`${getNameFn ? getNameFn(targetFilter.name) : targetFilter.name}${inClause}${filterOptions.join(';')};`);
      }
    }else{ //plain key/val filter object
      filters.push(`${key}${inClause}${targetFilter};`);
    }
  });
  return filters;
}

function formatGroupByURL(activeGroupers) {
  if(typeof activeGroupers === 'string'){
    return activeGroupers;
  }
  let groupBy;
  let groupByString;
  if(activeGroupers && activeGroupers.options) {
    groupBy = activeGroupers.options.map(grouper => grouper.key);
    groupByString = arrayToCSV(groupBy, false);
  }
  return groupByString;
}

function formatGroupByParams(activeGroupers){
  let groupBy;
  if(typeof activeGroupers === 'string'){
    return activeGroupers.split(',');
  }
  if(activeGroupers && activeGroupers.options) {
    groupBy = activeGroupers.options.map(grouper => grouper.key);
  }
  return groupBy;
}

function convertArrayToDictionary(arr, fn) {
  const rlt = {};
  if(!arr) {
    return rlt;
  }
  for(const a of arr) {
    const {name, value} = fn(a);
    rlt[name] = value;
  }
  return rlt;
}

function defaultTableIconStyle(color) {
  const style = {
    float: 'right',
    paddingRight: 2,
    paddingTop: 2,
  };
  if(color) {
    style.color = color;
  }
  return style;
}

function fakedTableIconStyle(color) {
  const style = {
    float: 'right',
    marginRight: 2,
    marginTop: 3,
    paddingTop: 2,
    paddingLeft: 2,
  };
  if(color) {
    style.color = color;
  }
  return style;
}

function renderFontAwesomeIcon(iconName, style={}) {
  return(
    <i
      className={`fa fa-${iconName}`}
      aria-hidden="true"
      style={style}
    />
  );
}

/**
 * return trimmed `rawItem` whose remaing fields is in array `fieldNames`;
 * @param {Array} fieldNames the fields to KEEP
 * @param {Object} rawItem the raw item
 * @returns {Object} trimmer result
 */
function trimFields(fieldNames, rawItem) {
  qa0(fieldNames.forEach);
  const result = {};
  fieldNames.forEach(field => {
    if (rawItem && rawItem[field]) {
      result[field] = rawItem[field];
    }
  });
  return result;
}

function arrayToCSV(array, sort = true) {
  if(Array.isArray(array)) {
    if(sort) {
      array.sort();
    }
    return array.join(',');
  }
  return array;
}

function stripProtocolAndHost(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }
  return url.replace(/(^http:|^https:)\/\/[A-Za-z0-9:._-]+\//, '/');

}

function applyAndSetToken(headers, url, tokenParams = null) {
  if (!tokenParams) {
    return headers;
  }
  tokenParams.tokenIndex = -1;
  let token = null;
  let i = 0;
  const headersModified = Object.assign({}, headers);
  if (url !== 'token-init') {
    while (i < TokenStore.tokens.length) {
      if (TokenStore.tokens[i] !== null) {
        token = TokenStore.tokens[i];
        TokenStore.setTokenByIndex(null, i);
        tokenParams.tokenIndex = i;
        break;
      }
      i++;
    }
  }

  if (!token) {
    token = TokenStore.getCsrfTokenByKey(stripProtocolAndHost(url));
  }

  headersModified['X-CSRF-SAFE'] = 'true';
  if (token) {
    const ctime = new Date().getTime();
    token = token.concat(btoa(`;CT:${ctime.toString()};TI:${tokenParams.tokenIndex};`));
    headersModified['X-TOKEN'] = token;
  }
  return headersModified;
}

// this is only used in SimpleTable implementation
function applyFilterAndSorter(rows, sortingColumns, tableName, filterOptions) {
  const cols = getColumnsFilter(filterOptions, tableName);
  // apply filter
  const rlt = filterRowsInPureJS(rows, cols);
  // apply sorter
  const sorters = getSortingColumns(sortingColumns, tableName);
  if(!sorters || !sorters.length) {
    return rlt;
  }
  qa0(sorters);
  sorters.sort((a, b) => a.priority - b.priority);
  rlt.sort((a, b) => {
    for(const s of sorters) {
      // In simple table row value field is flatterned, therefore slightly different from generic table
      const v1 = a[s.fieldName];
      const v2 = b[s.fieldName];
      if(s.direction === 'asc') {
        if(v1 > v2 ) {
          return 1;
        }
        if(v1 < v2) {
          return -1;
        }
      } else {
        if(v1 > v2 ) {
          return -1;
        }
        if(v1 < v2) {
          return 1;
        }
      }
    }
    return 0;
  });
  return rlt;
}

// PCS-16305 this method should replace the standard fetch method, to enable csrf tokens in header and
// allow retry of api call if failed previously
const fetchRetry = async (url, options, tokenParams = null) => {
  const controller = new AbortController();
  options.signal = controller.signal;
  let response;

  // Abort the fetch call if it takes more than 60 seconds.
  const fetchTimeout = setTimeout(() => {
    if(!response) {
      controller.abort();
      messageBox('Server didn\'t respond in a timely fashion');
    }
  }, 60000);
  try {
    response = await fetch(url, options);
  }catch(err){
    //clear timeout since we got response!
    clearTimeout(fetchTimeout);
    console.error(err);
    throw err;
  }

  //clear timeout since we got response!
  clearTimeout(fetchTimeout);

  if (!response.ok) {
    if (response.status === 403 && response.url.indexOf('api/tokens') !== -1) {
      return response.text().then(function (text) {
        return {token: JSON.parse(text).token, status: 403};
      });
    }
    const error = new Error();
    error.response = response;
    // Either response.json() or response.text() is called, but not both
    // and they could only be called once, that's design from `fetch`
    // for "performance" reason.
    // Since backend may send us either the plain text or json
    // we process the response as text, then try to convert response to json
    // so we can handle both format.
    error.errorTextPromise = response.text();

    Sentry.captureException(error);

    throw error;
  }

  if (tokenParams) {
    const csrfKey = stripProtocolAndHost(response.url);
    const csrfValue = response?.headers.get('X-TOKEN');
    console.log('csrfValue retrieved from header => ', 'val=', csrfValue);
    if (response.status === 204 && tokenParams.retry === 0) {
      TokenStore.setCsrfTokenByKey(csrfValue, csrfKey);
      tokenParams.retry = 1;
      return await fetchRetry(url, options, tokenParams);
    }
    if (response.status === 200 && !!csrfValue) {
      if (tokenParams.tokenIndex >= 0) {
        TokenStore.setTokenByIndex(csrfValue, tokenParams.tokenIndex);
      } else {
        TokenStore.setCsrfTokenByKey(csrfValue, csrfKey);
      }
    }
  }

  return response.text().then(function(text) {
    return text? JSON.parse(text) : {};
  });
};

function adjustHierarchyColumnWidth(w) {
  const minColumnWidth = 250;
  const maxColumnWidth = 350;
  if(w < minColumnWidth) {
    return minColumnWidth;
  }
  if(w > maxColumnWidth) {
    return maxColumnWidth;
  }
  return w;
}

function filterText2Regex(v) {
  if(!v) {
    return null;
  }
  return new RegExp(v.replace(/ +/g, '.*'), 'i');
}

function getLibraryIcon(node,icons){
  let iconConfig=null;

  if (node && node.nodeTypeId === 2) {//TODO temporary until Graham's new icon solution is in, pls remove when it's commited
    iconConfig = {
      icon: 'building',
      colour: '#255aaf'
    };
  } else if(node && node.nodeTypeId === 12){
    iconConfig = {
      icon: node.icon,
      colour: node.iconColour,
      iconLibrary: node.iconLibrary
    };
  }else{
    iconConfig = {
      icon: 'asterisk',
      colour: '#CC8282'
    };
  }
  return (
    <span>
    {(<i style={{
      color: `${iconConfig.colour}`,
      paddingRight: '5px'
    }}
         className={`${iconConfig.iconLibrary || 'fas'} fa-${iconConfig.icon}`}/>)}
    </span>
  );
}

//@deprecated - may not be required any more as server will add Z to indicate UTC for datetime props
const formatISO8601 = (date) => {
  if(!date.endsWith('Z')){
    date = date + 'Z';
  }
  return date;
};

const LibraryIcon = (props) => (
  <span>
    {(<i style={{
      color: `${props.iconConfig.colour}`,
      paddingRight: '5px'
    }}
         className={`fas fa-${props.iconConfig.icon}`}/>)}
    </span>
);

function queryStringToJSON(url) {
  const pairs = url.split('&');

  const result = {};
  pairs.forEach(function(pair) {
    pair = pair.split('=');
    result[pair[0]] = decodeURIComponent(pair[1] || '');
  });

  return JSON.parse(JSON.stringify(result));
}

/**
 * Build a URL from the properties returned by a dataview navigation.
 *
 * Dataview navigations sometimes return query params in both the searchUrl
 * and the searchFilter properties. This function allows us to build a URL without
 * having additional logic around joining strings.
 *
 * @param {string} searchUrl the searchUrl returned by the dataview navigation
 * @param {string} searchFilter the searchFilter returned by the dataview navigation
 * @param {string} additonalQueryParams any addition query params that should be added to the URL
 *
 * @returns {string} the formatted URL
 */
function getSearchUrl(
  searchUrl = '',
  searchFilter = '',
  additonalQueryParams = ''
) {
  const urlParts = [searchUrl, searchFilter, additonalQueryParams]
    .filter(n => n)
    .join('&')
    .split('?');

  // TODO optionally inject object of params here?
  const queryOptions = Object.assign({}, queryString.parse(urlParts[1] || ''));

  return `${urlParts[0]}?${decodeURIComponent(
    queryString.stringify(queryOptions)
  )}`;
}

function filterColumnsWithoutResizeableFormatter(columns) {
  columns.forEach((column)=>{
    column.header.formatters= column.header.formatters.filter(formatter => formatter._uid !== 'resizableColumn');
  });
}

function getAdditionalInfo (processEntityData, property) {
  const additionalDisplayInformation = processEntityData.additionalDisplayInformation;
  return additionalDisplayInformation.attributeColumns.find(attrCol => attrCol.fieldName === property.fieldName);
}

function isNavigatedBack(pageName){
  return getStore().getState().primaryFilterOptions?.primaryFilter?.navigatedFromSource === pageName;
}

function isTargetPageAccessible(linkedUrl, menu){
  if(!menu){
    const {user:{menuItems}} = getStore().getState();
    menu = menuItems;
  }
  // console.log('##### isTargetPageAccessible(): linkedUrl:',linkedUrl, 'menu:', menu);
  const targetUrl = (linkedUrl.split('?'))[0]; //some URLs may have query params, eg: worktable
  let accessible = false;
  if(menu.length){
    accessible = menu.some((menuItem) => {
      return isTargetPageAccessible(targetUrl, menuItem);
    });
  }
  if(accessible) {
    return true; //no need to continue
  }
  if(menu.subMenus?.length){
    accessible = menu.subMenus.some((menuItem) => {
      return isTargetPageAccessible(targetUrl, menuItem);
    });
  }
  if(accessible) {
    return true;
  }
  accessible = menu?.url?.includes(targetUrl);
  // console.log('###### linkedUrl ',linkedUrl, 'accessible:', accessible);
  return accessible;
}

//TODO remove skipSecurityCheck - temp fix
async function processClickThru(linkedUrl, contextFilter, skipSecurityCheck, optionalNavigationData){
  console.log('processClickThru called: ', linkedUrl);
  if(!skipSecurityCheck && !isTargetPageAccessible(linkedUrl)){
    console.warn('User doesnt have access to -',linkedUrl);
    return null;
  }

  //always set includeChildren to true for click through
  if(contextFilter?.filterSpecification?.primaryFilter){
    contextFilter.filterSpecification.primaryFilter.includeChildren = true;
  }

  if(!isEmptyObject(contextFilter)) {
    await updatePrimaryFilterAction({contextFilter});
  }
  const targetLink = linkedUrl.startsWith('/')? linkedUrl: `/${linkedUrl}`;
  return history.push(targetLink,{...optionalNavigationData});
}

//deprecated, use processClickThru instead
async function filterSpecificationClickThrough({linkedUrl = '', apiUrl = '', source = '', filterSpecification = {}}) {
  if (filterSpecification && linkedUrl) {
    if (filterSpecification.primaryFilter) {
      filterSpecification.primaryFilter.includeChildren = true; //always set to true for click through
    }
    // We rely on source to decide when to use/clear clickthrough context, it is mandatory!
    if(!source){
      console.error('Clickthrough ignored as source is not set in contextFilter!');
      return null;
    }
    const contextFilter = {
      filterSpecification,
      apiUrl,
      source,
    };
    // await updatePrimaryFilterAction(primaryFilterParams);
    //  return history.push(`/${linkedUrl}`);
    processClickThru(linkedUrl, contextFilter);
  }
  return null;
}

function addDualAuthColumn(arr, config = {}, transitionResult, onClickPendingRow, rowKey, parentRowIsPendingRow = false) {
  // `authStatus` field must exist
  const {newExpandIcon, showLabel} = config;
  const col = {
    'columnName': 'Auth Status',
    'fieldName': 'authStatus',
    'rendererType': 'ICON',
    'pinned': true,
    'columnWidth': showLabel ? 160 : 80,
    'hasExtraRowDataToExport': 'authStatus'
  };


  const dualKeyConfig = {...config};
  dualKeyConfig.columnWidth = col.columnWidth;
  dualKeyConfig.getIcon = (val, {rowData, column}) => {
    const icons = [];
    const marginLeftOfStatusCircle = showLabel ? 8 : getCenteredIconLeft(column.columnWidth);
    const style = {
      color: rowData.authStatusColour || 'inherit',
      marginLeft: marginLeftOfStatusCircle,
      lineHeight: '20px',
      position: 'relative',
    };
    if(showLabel){
      style.marginRight = '6px';
    }
    //render icon only if val (not blank)
    if(val) {
      if(val === 'loading'){
        return (
          <MSGlyphicon glyph={'spinner'} className={'fa-spin'} style={style} title={'loading...'}/>
        );
      }
      if(rowData._transitionFailed){
        icons.push(<MSGlyphicon key={rowData.pendingChangeId+'_failed'} glyph={'exclamation-triangle'} style={{color: 'red'}} title={transitionResult.message}/>);
        style.marginLeft = parseInt(marginLeftOfStatusCircle / 2, 10);
      }
      icons.push(<MSGlyphicon key={rowData.pendingChangeId+'_status'} glyph={'circle'} style={style} title={val}/>);
    }
    return icons;
  };
  const iconFormatter = guessTableCellFormatter(col, dualKeyConfig);

  const expandFormatter = formatExpandBelowCurrentRowFactory(
    dualKeyConfig.columnWidth, {
      newExpandIcon,
      showLabel,
      caretUpProperty: '_isRowExpanded',
      onChange: onClickPendingRow,
      textFormatter: iconFormatter,
      testIcon: (val, {rowData}) => {
        if(parentRowIsPendingRow) {
          return rowData._hasOriginalRow;
        }
        if(isPendingId(rowData[rowKey])){
          return false;
        }
        return hasPendingRowChildAndIsExpandable(rowData);
      },
    },
  );
  arr.push(createTableColumnSetupFrom({
    props: {
      style: {
        minWidth: dualKeyConfig.columnWidth
      }
    },
    cell: {
      highlightClicked: true,
      props: {
        style: {
          textAlign: guessTextAlignment(col)
        }
      },
      formatters:[ expandFormatter ],
    },
  }, col));
}

function hexToRgbA(hex, opacity){
  let c;
  if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
    c= hex.substring(1).split('');
    if(c.length === 3){
      c= [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    c= '0x'+c.join('');
    return `rgba(${[(c>>16)&255, (c>>8)&255, c&255].join(',')},${opacity || 0})`;
  }
  return hex;
}

function filterDestinations(destinations, type){
  let filteredDestinations = [];
  if(destinations) {
    Object.keys(destinations).map(destinationKey => {
      const destinationGroup = destinations[destinationKey];
      const navigations = destinationGroup.filter(destination => destination.type === type);
      filteredDestinations = filteredDestinations.concat(navigations);
    });
  }
  if(!filteredDestinations.length){
    console.warn('No matching destinations found for type: ', type);
  }
  return filteredDestinations;
}

/*
Use this method to get the visible rows in a table when the table is using NonVirtual Bodyand for exporting Current DOM rows
*/
function getVisibleRowKeysFromTableRef(tableRef){
  const visibleRows = [];
  for(let i=0; i<tableRef.childNodes.length; i++){
    if(isSeen(tableRef.childNodes[i])){
      visibleRows.push(tableRef.childNodes[i]);
    }
  }
  const visibleKeys = [];
  visibleRows.forEach((tr)=>{
    if(tr.getAttribute('data-rowkey')){
      visibleKeys.push(
        parseInt(tr.getAttribute('data-rowkey').slice(0, -4), 10)
      );
    }
  });
  return visibleKeys;
}

function getPercentage(totalCount, count){
  return Math.floor((count / totalCount * 100));
}

function findRowIndex(rows, key, val){
  return rows.findIndex(elem => {
    return elem.values[key] === val;
  });
}

// PWP-1576.Format for sending filters in worktable search api.
function formatBodyParams(bodyParams) {
  return {
    primaryFilter : bodyParams
  };
}

function setStateAsync(state, that) {
  return new Promise((resolve) => {
    that.setState(state, resolve);
  });
}

export {
  ROW_HEIGHT,
  isNavigatedBack,
  createTableColumnSetupFrom,
  setTableContainerWidthTimely,
  getHeaderLabelWidth,
  cleanIdForExport,
  estimateColumnWidth,
  estimateHeaderHeight,
  estimateTableHeight,
  guessTextAlignment,
  stripId,
  str2num,
  renderResponseErrors,
  getUid,
  sortBy,
  sortByDescription,
  getColumnIndex,
  lineSep,
  maxLineLength,
  getColumnsTotalWidth,
  getPrimaryContainerPadding,
  getLeftSidebarWidth,
  getLeftSidebarHeight,
  getTableContainerWidth,
  getTableContainerWithLeftSidebarWidth,
  getTableContainerWithLeftSidebarWidthFromFundOverview,
  getTableContainerMinusPrimaryFilterHeight,
  getTableInTabWithLeftSidebarWidth,
  getTableWidth,
  filterText2Regex,
  getLibraryIcon,
  beforeRefresh,
  beforeLogout,
  statusColours,
  groupColumnsBy,
  getPreciseTextWidth,
  parseDate,
  parseTime,
  parseMultiple,
  parseBool,
  parseMoney,
  convertCellDatesToUTC,
  convertRowPropertyNames,
  validatorRequired,
  validatorAlphaNumeric,
  validatorDateTime,
  checkExternalDateLimit,
  removeWhitespace,
  retrieveStringBetweenParentheses,
  buildUrl,
  replaceUrlPlaceholders,
  navigationLookupTable,
  getSortingColumnsPattern,
  getSortPattern,
  getSubstringAfterCharacter,
  getWorkTableTitle,
  getRowHeight,
  newRow,
  spreadModelFlags,
  getElementOffset,
  extractZeroCellStatus,
  endsWith,
  nonZeroColumns,
  getDefaultDataViewCode,
  extractDefaultDataView,
  estimatePDFPageSize,
  applyHighLightRules,
  getConditionResult,
  hasHighLightRules,
  convertHighLightRulesData,
  isUserLoggedIn,
  convertTableSize,
  getTableSize,
  getSortColumnData,
  getColumnLabel,
  getColumnProperty,
  extractDefaultSortColumns,
  getSortingColumnFromObject,
  extractModelColumns,
  extractVisibleColumns,
  needProcessDefaultSortColumns,
  createSortingObject,
  needHandleSortingColumns,
  getTemplateCollectionCode,
  getUrlParam,
  getUrlParams,
  replaceOrAppendUrlParam,
  notZeroNorUndefined,
  spreadRowData,
  windowOpenUrl,
  processCellNewValue,
  convertToDescription,
  extractActiveStatus,
  needHandleFilteringColumns,
  extractBusinessObjectIds,
  extractInteger,
  convertToDescriptionArray,
  prepareApiSearchParams,
  prepareApiContextFilterParams,
  prepareApiDateParam,
  getLineCount,
  getMultiLineColumns,
  calculateRowHeight,
  extractTreeNodes,
  extractPinedProperties,
  truncateWithEllipses,
  extractValidationData,
  extractRenderingPropertiesData,
  makeGroup,
  extractMandatoryColumns,
  compareMandatoryColumnsWithEditedColumns,
  compareMandatoryColumnWithValues,
  reStructure,
  containsAllowedCharacters,
  mergeValidationResultFromServer,
  iterateTree,
  stripFirstAndLastCharacter,
  convertArrayToDictionary,
  defaultTableIconStyle,
  fakedTableIconStyle,
  renderFontAwesomeIcon,
  formatFilterURL,
  formatGroupByURL,
  trimFields,
  arrayToCSV,
  stripProtocolAndHost,
  applyAndSetToken,
  applyFilterAndSorter,
  fetchRetry,
  adjustHierarchyColumnWidth,
  toggleSortWithinSortList,
  createColumnSortClickHandler,
  formatISO8601,
  formatTime,
  toISOString,
  LibraryIcon,
  queryStringToJSON,
  getSearchUrl,
  filterColumnsWithoutResizeableFormatter,
  getDocumentScrollOffset,
  filterSpecificationClickThrough,
  getAdditionalInfo,
  addDualAuthColumn,
  hexToRgbA,
  filterDestinations,
  formatFiltersArraysObject,
  getVisibleRowKeysFromTableRef,
  getPercentage,
  findRowIndex,
  processClickThru,
  processNavigation,
  isTargetPageAccessible,
  formatBodyParams,
  setStateAsync,
};

// export * from './HttpFetch.js';
// export * from './SimpleModals.js';
// export * from './TableNames.js';
// export * from './BrowserStorage.js';
// export * from './FilterParser.js';
// export * from './DetectBrowser.js';
// export * from './FileSaveUtils.js';
// export * from './TableRulesUtils.js';
export * from './Format.js';
export * from './Check.js';
// export * from './SelectedCellData.js';
// export * from './DualAuth.js';
// export * from './UrlPath.js';
// export * from './Selectors.js';
// export * from './TreeRow.js';
// export * from './ExecutionCounter.js';
// export * from './TestResponse.js';
// export * from './SLAUtils.js';
// export * from './Timezone.js';
// export * from './PageDefaults.js';
// export * from './TreeComboUtil.js';
// export * from 'WorkTables/WorkTables.utils.js';
export * from './AgGridUtil.js';
