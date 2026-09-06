import { describe, it, expect, beforeEach } from 'vitest';
import { generateLocators, getUniquenessCount } from '../utils/locators';

describe('Exhaustive — Positive (must be Playwright-only, correct rank)', () => {
  beforeEach(() => (document.body.innerHTML = ''));

  it('P1 data-testid stable', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', 'submit');
    el.textContent = 'Submit';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    expect(locs[0].value).toBe("page.getByTestId('submit')");
    expect(locs.every((l) => l.value.startsWith('page.'))).toBe(true);
  });

  it('P2 data-testid with quotes escapes', () => {
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'a\'b"c\\d');
    document.body.appendChild(el);
    const locs = generateLocators(el);
    const v = locs.find((l) => l.kind === 'testId')!.value;
    expect(v).toContain("\\'");
    expect(v).toContain('\\\\');
  });

  it('P5 label for > placeholder', () => {
    const label = document.createElement('label');
    label.setAttribute('for', 'e');
    label.textContent = 'Email';
    const input = document.createElement('input');
    input.id = 'e';
    input.setAttribute('placeholder', 'Enter email');
    document.body.append(label, input);
    const locs = generateLocators(input);
    const li = locs.findIndex((l) => l.kind === 'label');
    const pi = locs.findIndex((l) => l.kind === 'placeholder');
    expect(li).toBeLessThan(pi);
    expect(locs.find((l) => l.kind === 'label')!.score).toBeGreaterThan(
      locs.find((l) => l.kind === 'placeholder')!.score
    );
  });

  it('P7 heading level 2', () => {
    const h = document.createElement('h2');
    h.textContent = 'Title';
    document.body.appendChild(h);
    const locs = generateLocators(h);
    expect(locs.some((l) => l.value.includes('level: 2'))).toBe(true);
  });

  it('P8 link with href', () => {
    const a = document.createElement('a');
    a.href = 'https://example.com';
    a.textContent = 'Go';
    document.body.appendChild(a);
    expect(generateLocators(a).some((l) => l.value.includes("getByRole('link'"))).toBe(true);
  });

  it('P9 img alt', () => {
    const img = document.createElement('img');
    img.alt = 'Logo';
    document.body.appendChild(img);
    expect(generateLocators(img).some((l) => l.value.includes("getByAltText('Logo')"))).toBe(true);
  });

  it('P10 checkbox aria-label', () => {
    const el = document.createElement('input');
    (el as HTMLInputElement).type = 'checkbox';
    el.setAttribute('aria-label', 'Accept');
    document.body.appendChild(el);
    expect(generateLocators(el).some((l) => l.value.includes("getByRole('checkbox'"))).toBe(true);
  });

  it('P14 CSS fallback is Playwright locator', () => {
    const parent = document.createElement('div');
    parent.id = 'parent';
    const child = document.createElement('span');
    child.textContent = 'child';
    parent.appendChild(child);
    document.body.appendChild(parent);
    const css = generateLocators(child).find((l) => l.kind === 'css')!;
    expect(css.value.startsWith("page.locator('")).toBe(true);
  });
});

describe('Negative — must not break', () => {
  beforeEach(() => (document.body.innerHTML = ''));

  it('N2 detached element does not throw', () => {
    const el = document.createElement('div');
    expect(() => generateLocators(el)).not.toThrow();
    expect(generateLocators(el).every((l) => l.value.startsWith('page.'))).toBe(true);
  });

  it('N3 empty text no getByText', () => {
    const btn = document.createElement('button');
    btn.textContent = '   ';
    document.body.appendChild(btn);
    const locs = generateLocators(btn);
    expect(locs.some((l) => l.kind === 'text' && l.value.includes("''"))).toBe(false);
    expect(locs.find((l) => l.value === "page.getByRole('button')")!.score).toBe(40);
  });

  it('N4 long text not used for getByText', () => {
    const el = document.createElement('span');
    el.textContent = 'a'.repeat(200);
    document.body.appendChild(el);
    const locs = generateLocators(el);
    // long text >80 should NOT generate getByText (avoids flaky), falls to css/xpath only
    expect(locs.some((l) => l.kind === 'text')).toBe(false);
    expect(locs.some((l) => l.kind === 'css')).toBe(true);
  });

  it('N7 dynamic IDs filtered', () => {
    for (const id of ['radix-:r1:', 'ember123', '__next', ':r2:', 'mui-123-456']) {
      document.body.innerHTML = '';
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
      expect(generateLocators(el).some((l) => l.kind === 'id' && l.value.includes(id))).toBe(false);
    }
  });

  it('N8 hidden aria-hidden no role 95', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    const btn = document.createElement('button');
    btn.textContent = 'Hidden';
    wrap.appendChild(btn);
    document.body.appendChild(wrap);
    const locs = generateLocators(btn);
    expect(locs.some((l) => l.score === 95 && l.value.includes('Hidden'))).toBe(false);
  });

  it('N10 role presentation returns null', () => {
    const el = document.createElement('div');
    el.setAttribute('role', 'presentation');
    el.textContent = 'x';
    document.body.appendChild(el);
    expect(generateLocators(el).some((l) => l.value.includes('presentation'))).toBe(false);
  });

  it('N12 SVG text leaf', () => {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg') as unknown as Element;
    const text = document.createElementNS(svgNS, 'text') as unknown as Element;
    text.textContent = 'SVG Text';
    svg.appendChild(text);
    document.body.appendChild(svg);
    expect(() => generateLocators(text)).not.toThrow();
  });

  it('N13 CSS.escape for colon', () => {
    const el = document.createElement('div');
    el.id = 'my:id';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    // id with colon fails regex /^[a-zA-Z][\w-]*$/ so no id locator, but css fallback should escape
    expect(locs.some((l) => l.kind === 'id' && l.value.includes('my:id'))).toBe(false);
  });

  it('N14 wrapped label', () => {
    const label = document.createElement('label');
    label.textContent = 'Wrapped ';
    const input = document.createElement('input');
    input.type = 'text';
    label.appendChild(input);
    document.body.appendChild(label);
    const locs = generateLocators(input);
    expect(locs.some((l) => l.kind === 'label' && l.value.includes('Wrapped'))).toBe(true);
  });

  it('N15 aria-labelledby multi', () => {
    const r1 = document.createElement('span');
    r1.id = 'r1';
    r1.textContent = 'First';
    const r2 = document.createElement('span');
    r2.id = 'r2';
    r2.textContent = 'Second';
    const btn = document.createElement('button');
    btn.setAttribute('aria-labelledby', 'r1 r2');
    document.body.append(r1, r2, btn);
    expect(generateLocators(btn).some((l) => l.value.includes('First Second'))).toBe(true);
  });

  it('N19 alt only for img', () => {
    const div = document.createElement('div');
    div.setAttribute('alt', 'not-img');
    document.body.appendChild(div);
    expect(generateLocators(div).some((l) => l.kind === 'alt')).toBe(false);
  });

  it('N20 anchor without href not link', () => {
    const a = document.createElement('a');
    a.textContent = 'Click';
    document.body.appendChild(a);
    expect(generateLocators(a).some((l) => l.value.includes("getByRole('link'"))).toBe(false);
  });

  it('N5 backslash and newline escaped', () => {
    const el = document.createElement('button');
    el.setAttribute('data-testid', 'a\\b\nc');
    document.body.appendChild(el);
    const v = generateLocators(el).find((l) => l.kind === 'testId')!.value;
    expect(v).toContain('\\\\');
    expect(v).toContain('\\n');
  });
});

describe('Edge — real-world', () => {
  beforeEach(() => (document.body.innerHTML = ''));

  it('E6 nested button span: role on button', () => {
    const btn = document.createElement('button');
    const span = document.createElement('span');
    span.textContent = 'Submit';
    btn.appendChild(span);
    document.body.appendChild(btn);
    const locs = generateLocators(btn);
    expect(locs.some((l) => l.value.includes("getByRole('button'"))).toBe(true);
    // leaf restriction: button has children so no getByText on button itself
    expect(locs.filter((l) => l.kind === 'text').length).toBe(0);
  });

  it('E13 duplicate IDs: not unique, fallback to css', () => {
    const a = document.createElement('div');
    a.id = 'dup';
    const b = document.createElement('div');
    b.id = 'dup';
    document.body.append(a, b);
    const locs = generateLocators(a);
    // id locator should still be generated but querySelectorAll length >1 means not unique; we still generate but count check would show >1
    expect(locs.some((l) => l.kind === 'id')).toBe(true);
    expect(getUniquenessCount("page.locator('#dup')", 'id')).toBe(2);
  });

  it('E15 input hidden not textbox', () => {
    const el = document.createElement('input');
    (el as HTMLInputElement).type = 'hidden';
    document.body.appendChild(el);
    expect(generateLocators(el).some((l) => l.kind === 'role')).toBe(false);
  });

  it('All locators Playwright-only', () => {
    const el = document.createElement('div');
    el.id = 'test';
    el.setAttribute('data-testid', 't');
    el.textContent = 'hi';
    document.body.appendChild(el);
    const locs = generateLocators(el);
    for (const l of locs) {
      expect(l.value.startsWith('page.')).toBe(true);
      expect(l.value).not.toBe('#test');
    }
  });

  it('E11 heading level preserved', () => {
    const h1 = document.createElement('h1');
    h1.textContent = 'H1';
    document.body.appendChild(h1);
    expect(generateLocators(h1).some((l) => l.value.includes('level: 1'))).toBe(true);
  });
});
