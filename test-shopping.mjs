import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_URL = 'file:///' + path.join(__dirname, 'shopping-list.html').replace(/\\/g, '/');

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL}  ${label}`);
    failed++;
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();

  await page.goto(FILE_URL);
  await page.evaluate(() => localStorage.removeItem('shoppingList'));
  await page.reload();

  console.log('\n══════════════════════════════════════════');
  console.log('  쇼핑리스트 앱 자동 테스트');
  console.log('══════════════════════════════════════════\n');

  console.log('【1】 아이템 추가');

  await page.fill('#newItem', '사과');
  await page.click('#addBtn');
  let items = await page.locator('.item').count();
  assert(items === 1, '버튼 클릭으로 아이템 추가');

  await page.fill('#newItem', '바나나');
  await page.press('#newItem', 'Enter');
  items = await page.locator('.item').count();
  assert(items === 2, 'Enter 키로 아이템 추가');

  const texts = await page.locator('.item-text').allTextContents();
  assert(texts.includes('사과') && texts.includes('바나나'), '추가된 아이템 텍스트 정확성');

  await page.fill('#newItem', '   ');
  await page.click('#addBtn');
  items = await page.locator('.item').count();
  assert(items === 2, '빈 문자열 추가 방지');

  for (const name of ['우유', '계란', '빵']) {
    await page.fill('#newItem', name);
    await page.press('#newItem', 'Enter');
  }
  items = await page.locator('.item').count();
  assert(items === 5, '여러 아이템 순차 추가 (총 5개)');

  const stats = await page.locator('#stats').textContent();
  assert(stats.includes('0/5'), '헤더 통계 업데이트 (0/5 완료)');

  console.log('\n【2】 체크(완료) 기능');

  await page.locator('.check-btn').first().click();
  const checkedCount = await page.locator('.item.checked').count();
  assert(checkedCount === 1, '아이템 체크(완료 표시)');

  const strikeThrough = await page.locator('.item.checked .item-text').evaluate(
    el => window.getComputedStyle(el).textDecoration
  );
  assert(strikeThrough.includes('line-through'), '완료된 아이템에 취소선 표시');

  const checkMark = await page.locator('.item.checked .check-btn').textContent();
  assert(checkMark.trim() === '✓', '체크 버튼에 ✓ 표시');

  const stats2 = await page.locator('#stats').textContent();
  assert(stats2.includes('1/5'), '통계 업데이트 (1/5 완료)');

  await page.locator('.check-btn').nth(1).click();
  const checkedCount2 = await page.locator('.item.checked').count();
  assert(checkedCount2 === 2, '두 번째 아이템 체크 (총 2개 완료)');

  await page.locator('.check-btn').first().click();
  const checkedAfterToggle = await page.locator('.item.checked').count();
  assert(checkedAfterToggle === 1, '체크 토글 (완료 → 미완료)');

  console.log('\n【3】 필터 기능');

  await page.click('[data-filter="done"]');
  const doneItems = await page.locator('.item').count();
  assert(doneItems === 1, '"완료" 필터 – 완료된 아이템만 표시');

  await page.click('[data-filter="active"]');
  const activeItems = await page.locator('.item').count();
  assert(activeItems === 4, '"미완료" 필터 – 미완료 아이템만 표시');

  await page.click('[data-filter="all"]');
  const allItems = await page.locator('.item').count();
  assert(allItems === 5, '"전체" 필터 – 모든 아이템 표시');

  console.log('\n【4】 아이템 삭제');

  const beforeDelete = await page.locator('.item').count();
  await page.locator('.delete-btn').first().click();
  const afterDelete = await page.locator('.item').count();
  assert(afterDelete === beforeDelete - 1, '개별 삭제 버튼으로 아이템 삭제');

  const clearBtnDisabled = await page.locator('#clearDone').isDisabled();
  assert(!clearBtnDisabled, '"완료 항목 삭제" 버튼 활성 상태');

  const beforeClear = await page.locator('.item').count();
  await page.click('#clearDone');
  const afterClear = await page.locator('.item').count();
  const checkedAfterClear = await page.locator('.item.checked').count();
  assert(checkedAfterClear === 0, '완료 항목 일괄 삭제');
  assert(afterClear < beforeClear, '일괄 삭제 후 전체 목록 감소');

  const clearBtnDisabledAfter = await page.locator('#clearDone').isDisabled();
  assert(clearBtnDisabledAfter, '완료 항목 없을 때 버튼 비활성');

  console.log('\n【5】 데이터 영속성 (localStorage)');

  await page.fill('#newItem', '새로고침 테스트');
  await page.press('#newItem', 'Enter');
  const beforeReload = await page.locator('.item').count();
  await page.reload();
  const afterReload = await page.locator('.item').count();
  assert(afterReload === beforeReload, '새로고침 후 데이터 유지 (localStorage)');

  const reloadTexts = await page.locator('.item-text').allTextContents();
  assert(reloadTexts.some(t => t.includes('새로고침 테스트')), '새로고침 후 아이템 텍스트 유지');

  const total = passed + failed;
  console.log('\n══════════════════════════════════════════');
  console.log(`  테스트 결과: ${passed}/${total} 통과`);
  if (failed > 0) {
    console.log(`  실패: ${failed}개`);
  } else {
    console.log('  모든 테스트 통과! 🎉');
  }
  console.log('══════════════════════════════════════════\n');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
})();
