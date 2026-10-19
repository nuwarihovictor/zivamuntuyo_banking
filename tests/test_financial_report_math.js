"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("app.js", "utf8");
const start = source.indexOf("window.calculateFinancialReportGroups = function(rows)");
const end = source.indexOf("window.loadFinancialReports = async function()", start);
assert.ok(start >= 0 && end > start, "report calculation helpers must exist before the report loader");
const context = { window: {} };
vm.runInNewContext(source.slice(start, end), context);
const { calculateFinancialReportGroups, calculateFinancialStatementAmounts } = context.window;

const reconciledRows = [
  { currency_code: "UGX", ledger_type: "asset", debit_total: 150, credit_total: 0, net_balance: 150 },
  { currency_code: "UGX", ledger_type: "liability", debit_total: 0, credit_total: 80, net_balance: -80 },
  { currency_code: "UGX", ledger_type: "equity", debit_total: 0, credit_total: 20, net_balance: -20 },
  { currency_code: "UGX", ledger_type: "income", debit_total: 0, credit_total: 70, net_balance: -70 },
  { currency_code: "UGX", ledger_type: "expense", debit_total: 20, credit_total: 0, net_balance: 20 },
  { currency_code: "USD", ledger_type: "asset", debit_total: 100, credit_total: 0, net_balance: 100 },
  { currency_code: "USD", ledger_type: "liability", debit_total: 0, credit_total: 60, net_balance: -60 },
  { currency_code: "USD", ledger_type: "equity", debit_total: 0, credit_total: 10, net_balance: -10 },
  { currency_code: "USD", ledger_type: "income", debit_total: 0, credit_total: 40, net_balance: -40 },
  { currency_code: "USD", ledger_type: "expense", debit_total: 10, credit_total: 0, net_balance: 10 }
];
const grouped = calculateFinancialReportGroups(reconciledRows);
assert.deepEqual(Array.from(grouped.currencyEntries, ([currency, g]) => [currency, g.debit, g.credit]), [
  ["UGX", 170, 170],
  ["USD", 110, 110]
]);
assert.equal(grouped.unbalancedCurrencies.length, 0);
const ugx = calculateFinancialStatementAmounts(grouped.currencies.UGX.accounts);
const usd = calculateFinancialStatementAmounts(grouped.currencies.USD.accounts);
assert.deepEqual(
  [ugx.income, ugx.expenses, ugx.netResult, ugx.assets, ugx.liabilities, ugx.equity, ugx.totalClaims, ugx.difference],
  [70, 20, 50, 150, 80, 20, 150, 0]
);
assert.deepEqual(
  [usd.income, usd.expenses, usd.netResult, usd.assets, usd.liabilities, usd.equity, usd.totalClaims, usd.difference],
  [40, 10, 30, 100, 60, 10, 100, 0]
);

const broken = calculateFinancialReportGroups(reconciledRows.map(row =>
  row.currency_code === "UGX" && row.ledger_type === "expense"
    ? { ...row, debit_total: 25 }
    : row
));
assert.equal(broken.unbalancedCurrencies.length, 1);
assert.equal(broken.unbalancedCurrencies[0][0], "UGX");
assert.equal(broken.unbalancedCurrencies[0][1].debit - broken.unbalancedCurrencies[0][1].credit, 5);
assert.equal(calculateFinancialStatementAmounts(broken.currencies.UGX.accounts).difference, 5);
process.stdout.write("Financial report math tests passed: multi-currency grouping, statement totals, and imbalance detection.\n");
