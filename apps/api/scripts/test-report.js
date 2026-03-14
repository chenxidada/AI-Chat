#!/usr/bin/env node

/**
 * 自动化测试报告脚本
 * 运行所有测试并生成报告
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Knowledge Base API Test Runner\n');
console.log('=' .repeat(60));

const startTime = Date.now();
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

// 运行单元测试
console.log('\n📦 Running Unit Tests...\n');
try {
  const unitOutput = execSync('npm run test:cov -- --json --outputFile=test-results/unit.json 2>&1', {
    encoding: 'utf-8',
    cwd: process.cwd(),
    stdio: 'pipe'
  });
  console.log(unitOutput);
  passedTests += parseTestCount(unitOutput, 'passed');
  totalTests += parseTestCount(unitOutput, 'total');
} catch (error) {
  console.log(error.stdout || error.message);
  failedTests += parseTestCount(error.stdout || '', 'failed');
  totalTests += parseTestCount(error.stdout || '', 'total');
}

// 运行 E2E 测试
console.log('\n🔗 Running E2E Tests...\n');
try {
  const e2eOutput = execSync('npm run test:e2e -- --json --outputFile=test-results/e2e.json 2>&1', {
    encoding: 'utf-8',
    cwd: process.cwd(),
    stdio: 'pipe'
  });
  console.log(e2eOutput);
  passedTests += parseTestCount(e2eOutput, 'passed');
  totalTests += parseTestCount(e2eOutput, 'total');
} catch (error) {
  console.log(error.stdout || error.message);
  failedTests += parseTestCount(error.stdout || '', 'failed');
  totalTests += parseTestCount(error.stdout || '', 'total');
}

const endTime = Date.now();
const duration = ((endTime - startTime) / 1000).toFixed(2);

// 生成报告
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary Report\n');
console.log(`  Total Tests:  ${totalTests}`);
console.log(`  ✅ Passed:    ${passedTests}`);
console.log(`  ❌ Failed:    ${failedTests}`);
console.log(`  ⏭️  Skipped:   ${skippedTests}`);
console.log(`  ⏱️  Duration:  ${duration}s`);
console.log('='.repeat(60));

// 生成 JSON 报告
const report = {
  timestamp: new Date().toISOString(),
  duration: `${duration}s`,
  summary: {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    skipped: skippedTests,
    successRate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(2) + '%' : '0%'
  },
  coverage: await getCoverageSummary()
};

// 确保目录存在
const resultsDir = path.join(process.cwd(), 'test-results');
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

fs.writeFileSync(
  path.join(resultsDir, 'test-report.json'),
  JSON.stringify(report, null, 2)
);

console.log('\n📄 Report saved to: test-results/test-report.json\n');

// 退出码
process.exit(failedTests > 0 ? 1 : 0);

// 辅助函数
function parseTestCount(output, type) {
  const patterns = {
    passed: /(\d+) passed/,
    failed: /(\d+) failed/,
    total: /Tests:\s+(\d+)/,
    skipped: /(\d+) skipped/
  };
  const match = output.match(patterns[type]);
  return match ? parseInt(match[1]) : 0;
}

async function getCoverageSummary() {
  try {
    const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json');
    if (fs.existsSync(coveragePath)) {
      return JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
    }
  } catch (e) {
    // Ignore
  }
  return null;
}
