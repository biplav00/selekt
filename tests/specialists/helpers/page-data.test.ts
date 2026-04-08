import { buildRichPageData, emptyPageData } from '@/specialists/helpers/page-data';
import type { PageElement } from '@/types';
import { describe, expect, it } from 'vitest';

describe('buildRichPageData', () => {
  const elements: PageElement[] = [
    {
      tag: 'button',
      id: 'submit',
      classes: ['btn', 'btn-primary'],
      testId: 'submit-btn',
      role: 'button',
      ariaLabel: 'Submit form',
      name: '',
      placeholder: '',
      title: '',
      altText: '',
      text: 'Submit',
      matchCount: 1,
    },
    {
      tag: 'input',
      id: 'email',
      classes: ['form-input'],
      testId: '',
      role: 'textbox',
      ariaLabel: 'Email',
      name: 'email',
      placeholder: 'Enter email',
      title: '',
      altText: '',
      text: '',
      matchCount: 1,
    },
    {
      tag: 'a',
      id: '',
      classes: ['nav-link'],
      testId: '',
      role: 'link',
      ariaLabel: '',
      name: '',
      placeholder: '',
      title: 'Go home',
      altText: '',
      text: 'Home',
      matchCount: 3,
    },
    {
      tag: 'img',
      id: '',
      classes: [],
      testId: '',
      role: 'img',
      ariaLabel: '',
      name: '',
      placeholder: '',
      title: '',
      altText: 'Logo',
      text: '',
      matchCount: 1,
    },
  ];

  it('collects all unique IDs', () => {
    const data = buildRichPageData(elements);
    expect(data.ids).toContain('submit');
    expect(data.ids).toContain('email');
    expect(data.ids).toHaveLength(2);
  });

  it('collects all unique classes', () => {
    const data = buildRichPageData(elements);
    expect(data.classes).toContain('btn');
    expect(data.classes).toContain('btn-primary');
    expect(data.classes).toContain('form-input');
    expect(data.classes).toContain('nav-link');
  });

  it('collects all unique testIds', () => {
    const data = buildRichPageData(elements);
    expect(data.testIds).toEqual(['submit-btn']);
  });

  it('collects all unique roles', () => {
    const data = buildRichPageData(elements);
    expect(data.roles).toContain('button');
    expect(data.roles).toContain('textbox');
    expect(data.roles).toContain('link');
    expect(data.roles).toContain('img');
  });

  it('collects ariaLabels', () => {
    const data = buildRichPageData(elements);
    expect(data.ariaLabels).toContain('Submit form');
    expect(data.ariaLabels).toContain('Email');
  });

  it('collects names', () => {
    const data = buildRichPageData(elements);
    expect(data.names).toEqual(['email']);
  });

  it('collects placeholders', () => {
    const data = buildRichPageData(elements);
    expect(data.placeholders).toEqual(['Enter email']);
  });

  it('collects texts', () => {
    const data = buildRichPageData(elements);
    expect(data.texts).toContain('Submit');
    expect(data.texts).toContain('Home');
  });

  it('counts tags by matchCount', () => {
    const data = buildRichPageData(elements);
    expect(data.tags.button).toBe(1);
    expect(data.tags.input).toBe(1);
    expect(data.tags.a).toBe(3);
    expect(data.tags.img).toBe(1);
  });

  it('preserves elements array', () => {
    const data = buildRichPageData(elements);
    expect(data.elements).toBe(elements);
  });

  it('handles empty input', () => {
    const data = buildRichPageData([]);
    expect(data.ids).toHaveLength(0);
    expect(data.classes).toHaveLength(0);
    expect(data.elements).toHaveLength(0);
  });
});

describe('emptyPageData', () => {
  it('returns empty arrays and object', () => {
    const data = emptyPageData();
    expect(data.ids).toHaveLength(0);
    expect(data.classes).toHaveLength(0);
    expect(data.testIds).toHaveLength(0);
    expect(data.elements).toHaveLength(0);
    expect(data.tags).toEqual({});
  });
});
