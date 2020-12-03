//Utils - move as reqd from Format.js
import {format} from "date-fns";
import {isNullOrUndefined} from "./Check";
import React from "react";

export const serverTimeFormat_DateFns = 'HHmmssSSS'; // date format used by date-fns
// This function formats given JS Date to time string
export function formatTime(date, dateFormat = serverTimeFormat_DateFns){
  //default timeformat - HHmmsssss
  return format(date, dateFormat);
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