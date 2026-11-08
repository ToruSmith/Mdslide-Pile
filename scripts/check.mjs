#!/usr/bin/env node
// 檢查一個資料夾(書庫、主題或單一簡報)是否符合規則,並印出結構摘要。
// 給人用,也給 AI 用:做完簡報後先跑這個,確認沒有警告再交付。
// 規則本身在 app/core/check.js(網站的「檢查」按鈕用的是同一份)。
//
//   node scripts/check.mjs <資料夾>           例:node scripts/check.mjs content
//   node scripts/check.mjs <資料夾> --slides  連每張投影片的版型與標題都列出來

import { nodeSource } from './node-source.mjs';
import { checkLibrary, formatReport } from '../app/core/check.js';

const dir = process.argv.slice(2).find(a => !a.startsWith('--'));
if (!dir) { console.log('用法:node scripts/check.mjs <資料夾> [--slides]'); process.exit(1); }

const report = await checkLibrary(nodeSource(dir));
console.log(formatReport(report, { verbose: process.argv.includes('--slides') }));
if (report.problems.length) process.exitCode = 1;
