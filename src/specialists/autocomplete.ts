export type TokenType =
  | 'method'
  | 'string'
  | 'punctuation'
  | 'identifier'
  | 'operator'
  | ' whitespace'
  | 'unknown';

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

export interface ParseContext {
  format: 'css' | 'xpath' | 'playwright' | 'cypress' | 'selenium';
  tokens: Token[];
  cursor: number;
  currentToken: Token | null;
  previousToken: Token | null;
  previousNonWhitespaceToken: Token | null;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < input.length) {
    const char = input[pos];

    // Whitespace
    if (/\s/.test(char)) {
      let value = '';
      const start = pos;
      while (pos < input.length && /\s/.test(input[pos])) {
        value += input[pos++];
      }
      tokens.push({ type: 'whitespace', value, start, end: pos });
      continue;
    }

    // Punctuation
    if (/[.,:;()[\]{}]/.test(char)) {
      tokens.push({ type: 'punctuation', value: char, start: pos, end: pos + 1 });
      pos++;
      continue;
    }

    // Quoted strings
    if (char === '"' || char === "'") {
      const quote = char;
      let value = char;
      const start = pos;
      pos++;
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          value += input[pos++];
        }
        value += input[pos++];
      }
      if (pos < input.length) {
        value += input[pos++];
      }
      tokens.push({ type: 'string', value, start, end: pos });
      continue;
    }

    // Operators
    if (/[+\-*/=<>!]/.test(char)) {
      let value = '';
      const start = pos;
      while (pos < input.length && /[+\-*/=<>!]/.test(input[pos])) {
        value += input[pos++];
      }
      tokens.push({ type: 'operator', value, start, end: pos });
      continue;
    }

    // Identifiers (words)
    if (/[a-zA-Z_$]/.test(char)) {
      let value = '';
      const start = pos;
      while (pos < input.length && /[a-zA-Z0-9_$]/.test(input[pos])) {
        value += input[pos++];
      }
      tokens.push({ type: 'identifier', value, start, end: pos });
      continue;
    }

    // Hash for CSS IDs or hash operators
    if (char === '#') {
      let value = '#';
      const start = pos;
      pos++;
      // Check if followed by identifier (CSS ID) or just hash
      while (pos < input.length && /[a-zA-Z0-9_-]/.test(input[pos])) {
        value += input[pos++];
      }
      // If we captured an identifier after #, it's a CSS ID token
      if (value.length > 1) {
        tokens.push({ type: 'identifier', value, start, end: pos });
      } else {
        tokens.push({ type: 'punctuation', value, start, end: pos });
      }
      continue;
    }

    // Dot for CSS classes or method chaining
    if (char === '.') {
      let value = '.';
      const start = pos;
      pos++;
      // Check if followed by identifier (CSS class or method chain)
      while (pos < input.length && /[a-zA-Z0-9_-]/.test(input[pos])) {
        value += input[pos++];
      }
      // If we captured something after ., it's either a CSS class or method chain
      if (value.length > 1) {
        tokens.push({ type: 'identifier', value, start, end: pos });
      } else {
        tokens.push({ type: 'punctuation', value, start, end: pos });
      }
      continue;
    }

    // Default: unknown
    tokens.push({ type: 'unknown', value: char, start: pos, end: pos + 1 });
    pos++;
  }

  return tokens;
}

export function detectFormat(
  input: string
): 'css' | 'xpath' | 'playwright' | 'cypress' | 'selenium' {
  const trimmed = input.trim();

  if (trimmed.startsWith('cy.')) return 'cypress';
  if (trimmed.startsWith('driver.') || trimmed.startsWith('By.')) return 'selenium';
  if (trimmed.startsWith('page.')) return 'playwright';
  if (trimmed.startsWith('//') || trimmed.startsWith('/')) return 'xpath';
  return 'css';
}

export function parseContext(input: string, cursor: number): ParseContext {
  const format = detectFormat(input);
  const tokens = tokenize(input);

  // Find the token containing or adjacent to cursor
  let currentToken: Token | null = null;
  let previousToken: Token | null = null;
  let previousNonWhitespaceToken: Token | null = null;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.start <= cursor && token.end >= cursor) {
      currentToken = token;
    }
    if (i > 0) {
      previousToken = tokens[i - 1];
    }
    if (token.type !== 'whitespace' && !previousNonWhitespaceToken) {
      previousNonWhitespaceToken = token;
    }
  }

  // Find previous non-whitespace token
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].type !== 'whitespace') {
      previousNonWhitespaceToken = tokens[i];
      break;
    }
  }

  return {
    format,
    tokens,
    cursor,
    currentToken,
    previousToken,
    previousNonWhitespaceToken,
  };
}

export interface AutocompleteSuggestion {
  label: string;
  insertText: string;
  detail?: string;
  type: 'method' | 'role' | 'property' | 'value' | 'text' | 'snippet';
}

export interface AutocompleteContext {
  context: ParseContext;
  partial: string;
  pageData: PageElement[];
}

export function generateAutocompleteSuggestions(
  ctx: AutocompleteContext
): AutocompleteSuggestion[] {
  const { context, pageData } = ctx;
  const { format, tokens, cursor, currentToken, previousNonWhitespaceToken } = context;

  // Get the partial text being typed (current token value up to cursor)
  let partial = '';
  if (currentToken) {
    partial = currentToken.value.slice(0, cursor - currentToken.start);
  } else if (tokens.length > 0) {
    // Check if cursor is after last token (at end of input)
    const lastToken = tokens[tokens.length - 1];
    if (lastToken.end <= cursor) {
      partial = '';
    }
  }

  switch (format) {
    case 'playwright':
      return getPlaywrightSuggestions(context, partial, pageData);
    case 'css':
      return getCssSuggestions(context, partial, pageData);
    case 'xpath':
      return getXPathSuggestions(context, partial, pageData);
    case 'cypress':
      return getCypressSuggestions(context, partial, pageData);
    case 'selenium':
      return getSeleniumSuggestions(context, partial, pageData);
    default:
      return [];
  }
}

// ============================================================================
// Playwright Suggestions
// ============================================================================

function getPlaywrightSuggestions(
  ctx: ParseContext,
  partial: string,
  pageData: PageElement[]
): AutocompleteSuggestion[] {
  const { tokens, previousNonWhitespaceToken } = ctx;

  // After "page." - suggest methods
  if (isAfterToken(tokens, 'page', '.')) {
    return [
      { label: 'getByRole', insertText: 'getByRole(', detail: 'Locate by ARIA role' },
      { label: 'getByText', insertText: 'getByText(', detail: 'Locate by text content' },
      { label: 'getByTestId', insertText: 'getByTestId(', detail: 'Locate by test ID' },
      { label: 'getByLabel', insertText: 'getByLabel(', detail: 'Locate by label text' },
      {
        label: 'getByPlaceholder',
        insertText: 'getByPlaceholder(',
        detail: 'Locate by placeholder',
      },
      { label: 'getByAltText', insertText: 'getByAltText(', detail: 'Locate by alt text' },
      { label: 'getByTitle', insertText: 'getByTitle(', detail: 'Locate by title attribute' },
      { label: 'locator', insertText: 'locator(', detail: 'Locate by CSS or XPath' },
      { label: 'filter', insertText: 'filter(', detail: 'Filter locator' },
    ].filter((s) => s.label.toLowerCase().startsWith(partial.toLowerCase()));
  }

  // After "getByRole(" - suggest roles
  if (isAfterMethodCall(tokens, 'getByRole')) {
    return getRoleSuggestions(partial, pageData);
  }

  // After "getByTestId(" - suggest testIds from page
  if (isAfterMethodCall(tokens, 'getByTestId')) {
    return getTestIdSuggestions(partial, pageData);
  }

  // After "getByLabel(" - suggest labels from page
  if (isAfterMethodCall(tokens, 'getByLabel')) {
    return getLabelSuggestions(partial, pageData);
  }

  // After "getByPlaceholder(" - suggest placeholders from page
  if (isAfterMethodCall(tokens, 'getByPlaceholder')) {
    return getPlaceholderSuggestions(partial, pageData);
  }

  // After "getByAltText(" - suggest alt text from page
  if (isAfterMethodCall(tokens, 'getByAltText')) {
    return getAltTextSuggestions(partial, pageData);
  }

  // After "getByTitle(" - suggest titles from page
  if (isAfterMethodCall(tokens, 'getByTitle')) {
    return getTitleSuggestions(partial, pageData);
  }

  // After "getByText(" - suggest text snippets
  if (isAfterMethodCall(tokens, 'getByText')) {
    return getTextSuggestions(partial, pageData);
  }

  // After "locator(" - suggest CSS selectors or XPath
  if (isAfterMethodCall(tokens, 'locator')) {
    return [
      ...getCssSuggestions(ctx, partial, pageData),
      ...getXPathSuggestions(ctx, partial, pageData),
    ];
  }

  // After "filter(" - suggest filter options
  if (isAfterMethodCall(tokens, 'filter')) {
    return [
      { label: '{ hasText: }', insertText: "{ hasText: '' }", detail: 'Filter by text' },
      { label: '{ has: }', insertText: "{ has: page.locator('') }", detail: 'Filter by locator' },
      {
        label: '{ hasNot: }',
        insertText: "{ hasNot: page.locator('') }",
        detail: 'Exclude by locator',
      },
      { label: '{ hasNotText: }', insertText: "{ hasNotText: '' }", detail: 'Exclude by text' },
    ].filter((s) => s.label.toLowerCase().includes(partial.toLowerCase()));
  }

  // After opening quote inside getByRole - suggest roles
  if (isInsideString(tokens, 'getByRole', "'") || isInsideString(tokens, 'getByRole', '"')) {
    return getRoleSuggestions(partial, pageData);
  }

  // Generic: suggest page methods if partial matches
  const methods = [
    'getByRole',
    'getByText',
    'getByTestId',
    'getByLabel',
    'getByPlaceholder',
    'getByAltText',
    'getByTitle',
    'locator',
    'filter',
  ];
  return methods
    .filter((m) => m.toLowerCase().startsWith(partial.toLowerCase()))
    .map((m) => ({ label: m, insertText: `${m}(`, detail: '' }));
}

// ============================================================================
// CSS Suggestions
// ============================================================================

function getCssSuggestions(
  ctx: ParseContext,
  partial: string,
  pageData: PageElement[]
): AutocompleteSuggestion[] {
  const { tokens, previousNonWhitespaceToken } = ctx;

  // After "#" - suggest IDs from page
  if (isAfterPunctuation(tokens, '#')) {
    return getIdSuggestions(partial.slice(1), pageData);
  }

  // After "." - suggest classes from page
  if (isAfterPunctuation(tokens, '.')) {
    return getClassSuggestions(partial.slice(1), pageData);
  }

  // After "[" - suggest attributes
  if (isAfterPunctuation(tokens, '[')) {
    return getCssAttributeSuggestions(partial);
  }

  // After "[data-" - suggest data attributes
  if (isAfterStringInAttribute(tokens, 'data-')) {
    return [
      { label: 'data-testid', insertText: 'data-testid="', detail: 'Test ID attribute' },
      { label: 'data-test', insertText: 'data-test="', detail: 'Test attribute' },
      { label: 'data-cy', insertText: 'data-cy="', detail: 'Cypress test ID' },
    ].filter((s) => s.label.toLowerCase().startsWith(partial.toLowerCase()));
  }

  // After attribute name (e.g., [aria-label) - suggest ="
  if (isInsideAttributeName(tokens)) {
    return [{ label: '="', insertText: '="', detail: 'Attribute value' }];
  }

  // After ":nth-child" or similar - suggest (
  if (isAfterPseudoSelector(tokens)) {
    return [{ label: '(', insertText: '(', detail: 'Pseudo-class argument' }];
  }

  // Suggest tag names at start
  if (tokens.length === 0 || (tokens.length === 1 && tokens[0].type === 'whitespace')) {
    return getTagSuggestions(partial, pageData);
  }

  // Generic attribute suggestions
  return getCssAttributeSuggestions(partial);
}

function getCssAttributeSuggestions(partial: string): AutocompleteSuggestion[] {
  const attributes = [
    { label: 'data-testid', insertText: 'data-testid="', detail: 'Test ID' },
    { label: 'data-test', insertText: 'data-test="', detail: 'Test attribute' },
    { label: 'aria-label', insertText: 'aria-label="', detail: 'ARIA label' },
    { label: 'aria-checked', insertText: 'aria-checked="', detail: 'ARIA checked state' },
    { label: 'aria-disabled', insertText: 'aria-disabled="', detail: 'ARIA disabled state' },
    { label: 'aria-expanded', insertText: 'aria-expanded="', detail: 'ARIA expanded state' },
    { label: 'aria-pressed', insertText: 'aria-pressed="', detail: 'ARIA pressed state' },
    { label: 'aria-selected', insertText: 'aria-selected="', detail: 'ARIA selected state' },
    { label: 'role', insertText: 'role="', detail: 'ARIA role' },
    { label: 'id', insertText: 'id="', detail: 'Element ID' },
    { label: 'class', insertText: 'class="', detail: 'CSS class' },
    { label: 'name', insertText: 'name="', detail: 'Form field name' },
    { label: 'type', insertText: 'type="', detail: 'Input type' },
    { label: 'placeholder', insertText: 'placeholder="', detail: 'Input placeholder' },
    { label: 'title', insertText: 'title="', detail: 'Title attribute' },
    { label: 'disabled', insertText: 'disabled', detail: 'Disabled attribute' },
    { label: 'checked', insertText: 'checked', detail: 'Checked attribute' },
    { label: 'required', insertText: 'required', detail: 'Required attribute' },
  ];

  return attributes
    .filter((a) => a.label.toLowerCase().startsWith(partial.toLowerCase()))
    .slice(0, 15);
}

// ============================================================================
// XPath Suggestions
// ============================================================================

function getXPathSuggestions(
  ctx: ParseContext,
  partial: string,
  pageData: PageElement[]
): AutocompleteSuggestion[] {
  const { tokens } = ctx;

  // After "//" or "/" - suggest axis and tags
  if (isAfterAxis(tokens)) {
    return [
      { label: '*', insertText: '*', detail: 'Any element' },
      { label: '@', insertText: '@', detail: 'Attribute axis' },
      { label: 'text()', insertText: 'text()', detail: 'Text node' },
      ...getTagSuggestions(partial.replace(/^\/+/, ''), pageData),
    ];
  }

  // After "[@" - suggest attributes
  if (isAfterXPathAttribute(tokens)) {
    return getXPathAttributeSuggestions(partial.slice(1)); // Remove @
  }

  // After "[contains(@" - suggest attributes for contains
  if (isAfterXPathContainsAttribute(tokens)) {
    return getXPathAttributeSuggestions(partial.replace(/^contains\(@/, ''));
  }

  // After "[@data-" or "[contains(@data-" - suggest data attributes
  if (isAfterXPathDataAttribute(tokens)) {
    return [
      { label: 'data-testid', insertText: 'data-testid="', detail: 'Test ID' },
      { label: 'data-test', insertText: 'data-test="', detail: 'Test attribute' },
    ].filter((s) => s.label.toLowerCase().startsWith(partial.toLowerCase()));
  }

  // After opening quote in predicate - suggest values or functions
  if (isInsideXPathPredicateString(tokens)) {
    return [
      {
        label: 'normalize-space()',
        insertText: 'normalize-space()',
        detail: 'Normalize whitespace',
      },
      { label: 'contains()', insertText: "contains(text(), '')", detail: 'Contains text' },
      { label: 'starts-with()', insertText: 'starts-with(@', detail: 'Starts with' },
    ];
  }

  // Generic suggestions
  return [
    { label: '//', insertText: '//', detail: 'Descendant axis' },
    { label: '/', insertText: '/', detail: 'Child axis' },
    { label: '[@', insertText: '[@', detail: 'Attribute predicate' },
    { label: '[1]', insertText: '[1]', detail: 'Position predicate' },
    { label: '[last()]', insertText: '[last()]', detail: 'Last element' },
    { label: '[contains(text(),', insertText: "[contains(text(), '')]", detail: 'Contains text' },
    {
      label: '[normalize-space()=',
      insertText: '[normalize-space(text())=',
      detail: 'Exact text (whitespace-normalized)',
    },
  ].filter((s) => s.label.toLowerCase().startsWith(partial.toLowerCase()));
}

function getXPathAttributeSuggestions(partial: string): AutocompleteSuggestion[] {
  const attributes = [
    { label: 'data-testid', insertText: 'data-testid="', detail: 'Test ID' },
    { label: 'data-test', insertText: 'data-test="', detail: 'Test attribute' },
    { label: 'aria-label', insertText: 'aria-label="', detail: 'ARIA label' },
    { label: 'aria-checked', insertText: 'aria-checked="', detail: 'ARIA checked' },
    { label: 'aria-disabled', insertText: 'aria-disabled="', detail: 'ARIA disabled' },
    { label: 'aria-expanded', insertText: 'aria-expanded="', detail: 'ARIA expanded' },
    { label: 'role', insertText: 'role="', detail: 'ARIA role' },
    { label: 'id', insertText: 'id="', detail: 'Element ID' },
    { label: 'name', insertText: 'name="', detail: 'Form field name' },
    { label: 'type', insertText: 'type="', detail: 'Input type' },
    { label: 'class', insertText: 'class="', detail: 'CSS class' },
    { label: 'placeholder', insertText: 'placeholder="', detail: 'Placeholder' },
    { label: 'title', insertText: 'title="', detail: 'Title' },
    { label: 'disabled', insertText: 'disabled="', detail: 'Disabled' },
    { label: 'checked', insertText: 'checked="', detail: 'Checked' },
  ];

  return attributes
    .filter((a) => a.label.toLowerCase().startsWith(partial.toLowerCase()))
    .slice(0, 12);
}

// ============================================================================
// Cypress Suggestions
// ============================================================================

function getCypressSuggestions(
  ctx: ParseContext,
  partial: string,
  pageData: PageElement[]
): AutocompleteSuggestion[] {
  const { tokens } = ctx;

  // After "cy." - suggest commands
  if (isAfterTokenValue(tokens, 'cy', '.')) {
    return [
      { label: 'get', insertText: 'get(', detail: 'Get element by selector' },
      { label: 'contains', insertText: 'contains(', detail: 'Contains text' },
      { label: 'findByRole', insertText: 'findByRole(', detail: 'Find by ARIA role' },
      { label: 'findByLabelText', insertText: 'findByLabelText(', detail: 'Find by label text' },
      { label: 'findByTestId', insertText: 'findByTestId(', detail: 'Find by test ID' },
      {
        label: 'findByPlaceholder',
        insertText: 'findByPlaceholder(',
        detail: 'Find by placeholder',
      },
      { label: 'findByAltText', insertText: 'findByAltText(', detail: 'Find by alt text' },
      { label: 'findByTitle', insertText: 'findByTitle(', detail: 'Find by title' },
      { label: 'root', insertText: 'root()', detail: 'Root element' },
    ].filter((s) => s.label.toLowerCase().startsWith(partial.toLowerCase()));
  }

  // After "findByRole(" - suggest roles
  if (isAfterMethodCall(tokens, 'findByRole')) {
    return getRoleSuggestions(partial, pageData);
  }

  // After "findByTestId(" - suggest testIds
  if (isAfterMethodCall(tokens, 'findByTestId')) {
    return getTestIdSuggestions(partial, pageData);
  }

  // After "findByLabelText(" - suggest labels
  if (isAfterMethodCall(tokens, 'findByLabelText')) {
    return getLabelSuggestions(partial, pageData);
  }

  // After "findByPlaceholder(" - suggest placeholders
  if (isAfterMethodCall(tokens, 'findByPlaceholder')) {
    return getPlaceholderSuggestions(partial, pageData);
  }

  // After "findByAltText(" - suggest alt text
  if (isAfterMethodCall(tokens, 'findByAltText')) {
    return getAltTextSuggestions(partial, pageData);
  }

  // After "findByTitle(" - suggest titles
  if (isAfterMethodCall(tokens, 'findByTitle')) {
    return getTitleSuggestions(partial, pageData);
  }

  // After "contains(" - suggest text
  if (isAfterMethodCall(tokens, 'contains')) {
    return getTextSuggestions(partial, pageData);
  }

  // After "cy.get(" or "get(" - suggest CSS selectors
  if (isAfterMethodCall(tokens, 'get')) {
    return getCssSuggestions(ctx, partial, pageData);
  }

  // Generic
  const commands = [
    'get',
    'contains',
    'findByRole',
    'findByLabelText',
    'findByTestId',
    'findByPlaceholder',
    'findByAltText',
    'findByTitle',
    'root',
  ];
  return commands
    .filter((c) => c.toLowerCase().startsWith(partial.toLowerCase()))
    .map((c) => ({ label: c, insertText: `${c}(`, detail: '' }));
}

// ============================================================================
// Selenium Suggestions
// ============================================================================

function getSeleniumSuggestions(
  ctx: ParseContext,
  partial: string,
  pageData: PageElement[]
): AutocompleteSuggestion[] {
  const { tokens } = ctx;

  // After "By." - suggest strategies
  if (isAfterTokenValue(tokens, 'By', '.')) {
    return [
      { label: 'id', insertText: 'id("")', detail: 'Find by ID' },
      { label: 'name', insertText: 'name("")', detail: 'Find by name' },
      { label: 'cssSelector', insertText: 'cssSelector("")', detail: 'Find by CSS' },
      { label: 'xpath', insertText: 'xpath("")', detail: 'Find by XPath' },
      { label: 'className', insertText: 'className("")', detail: 'Find by class' },
      { label: 'tagName', insertText: 'tagName("")', detail: 'Find by tag' },
      { label: 'linkText', insertText: 'linkText("")', detail: 'Find by link text' },
      {
        label: 'partialLinkText',
        insertText: 'partialLinkText("")',
        detail: 'Find by partial link text',
      },
    ].filter((s) => s.label.toLowerCase().startsWith(partial.toLowerCase()));
  }

  // After "driver.findElement(By." - suggest strategies
  if (
    isAfterTokenValue(tokens, 'driver.findElement', '(') ||
    isAfterMethodCall(tokens, 'driver.findElement')
  ) {
    return [
      { label: 'By.id', insertText: 'By.id("")', detail: 'Find by ID' },
      { label: 'By.name', insertText: 'By.name("")', detail: 'Find by name' },
      { label: 'By.cssSelector', insertText: 'By.cssSelector("")', detail: 'Find by CSS' },
      { label: 'By.xpath', insertText: 'By.xpath("")', detail: 'Find by XPath' },
    ].filter((s) => s.label.toLowerCase().startsWith(partial.toLowerCase()));
  }

  // Generic
  return [
    { label: 'By.id', insertText: 'By.id("")', detail: 'Find by ID' },
    { label: 'By.name', insertText: 'By.name("")', detail: 'Find by name' },
    { label: 'By.cssSelector', insertText: 'By.cssSelector("")', detail: 'Find by CSS' },
    { label: 'By.xpath', insertText: 'By.xpath("")', detail: 'Find by XPath' },
  ].filter((s) => s.label.toLowerCase().startsWith(partial.toLowerCase()));
}

// ============================================================================
// Value Suggestion Helpers
// ============================================================================

const ARIA_ROLES = [
  'alert',
  'alertdialog',
  'application',
  'article',
  'banner',
  'blockquote',
  'button',
  'caption',
  'cell',
  'checkbox',
  'code',
  'columnheader',
  'combobox',
  'complementary',
  'contentinfo',
  'definition',
  'dialog',
  'directory',
  'document',
  'feed',
  'figure',
  'form',
  'grid',
  'gridcell',
  'group',
  'heading',
  'img',
  'link',
  'list',
  'listbox',
  'listitem',
  'log',
  'main',
  'marquee',
  'math',
  'menu',
  'menubar',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'meter',
  'navigation',
  'none',
  'note',
  'option',
  'paragraph',
  'presentation',
  'progressbar',
  'radio',
  'radiogroup',
  'region',
  'row',
  'rowgroup',
  'rowheader',
  'scrollbar',
  'search',
  'searchbox',
  'separator',
  'slider',
  'spinbutton',
  'status',
  'strong',
  'subscript',
  'superscript',
  'switch',
  'tab',
  'table',
  'tablist',
  'tabpanel',
  'term',
  'textbox',
  'time',
  'timer',
  'toolbar',
  'tooltip',
  'tree',
  'treegrid',
  'treeitem',
];

function getRoleSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  return ARIA_ROLES.filter((r) => r.toLowerCase().startsWith(partial.toLowerCase()))
    .slice(0, 15)
    .map((r) => ({ label: `'${r}'`, insertText: `'${r}'`, detail: `ARIA ${r} role` }));
}

function getTestIdSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  const testIds = new Set<string>();
  for (const el of pageData) {
    if (el.testId) testIds.add(el.testId);
  }
  return Array.from(testIds)
    .filter((t) => t.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 15)
    .map((t) => ({ label: `'${t}'`, insertText: `'${t}'`, detail: `Test ID: ${t}` }));
}

function getIdSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  const ids = new Set<string>();
  for (const el of pageData) {
    if (el.id) ids.add(el.id);
  }
  return Array.from(ids)
    .filter((id) => id.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 15)
    .map((id) => ({ label: id, insertText: id, detail: `ID: #${id}` }));
}

function getClassSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  const classes = new Set<string>();
  for (const el of pageData) {
    for (const c of el.classes) classes.add(c);
  }
  return Array.from(classes)
    .filter((c) => c.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 15)
    .map((c) => ({ label: c, insertText: c, detail: `Class: .${c}` }));
}

function getLabelSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  const labels = new Set<string>();
  for (const el of pageData) {
    if (el.ariaLabel) labels.add(el.ariaLabel);
  }
  return Array.from(labels)
    .filter((l) => l.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 15)
    .map((l) => ({ label: `'${l}'`, insertText: `'${l}'`, detail: `Label: ${l}` }));
}

function getPlaceholderSuggestions(
  partial: string,
  pageData: PageElement[]
): AutocompleteSuggestion[] {
  const placeholders = new Set<string>();
  for (const el of pageData) {
    if (el.placeholder) placeholders.add(el.placeholder);
  }
  return Array.from(placeholders)
    .filter((p) => p.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 15)
    .map((p) => ({ label: `'${p}'`, insertText: `'${p}'`, detail: `Placeholder: ${p}` }));
}

function getAltTextSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  const altTexts = new Set<string>();
  for (const el of pageData) {
    if (el.altText) altTexts.add(el.altText);
  }
  return Array.from(altTexts)
    .filter((a) => a.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 15)
    .map((a) => ({ label: `'${a}'`, insertText: `'${a}'`, detail: `Alt text: ${a}` }));
}

function getTitleSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  const titles = new Set<string>();
  for (const el of pageData) {
    if (el.title) titles.add(el.title);
  }
  return Array.from(titles)
    .filter((t) => t.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 15)
    .map((t) => ({ label: `'${t}'`, insertText: `'${t}'`, detail: `Title: ${t}` }));
}

function getTextSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  const texts = new Set<string>();
  for (const el of pageData) {
    if (el.text && el.text.length <= 50) texts.add(el.text);
  }
  return Array.from(texts)
    .filter((t) => t.toLowerCase().includes(partial.toLowerCase()))
    .slice(0, 15)
    .map((t) => ({ label: `'${t}'`, insertText: `'${t}'`, detail: `Text: ${t.slice(0, 30)}` }));
}

function getTagSuggestions(partial: string, pageData: PageElement[]): AutocompleteSuggestion[] {
  const tags = new Set<string>();
  for (const el of pageData) {
    tags.add(el.tag);
  }
  const commonTags = [
    'div',
    'span',
    'input',
    'button',
    'a',
    'form',
    'label',
    'select',
    'textarea',
    'img',
    'table',
    'tr',
    'td',
    'th',
    'ul',
    'ol',
    'li',
    'nav',
    'header',
    'footer',
    'main',
    'section',
    'article',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
  ];
  return [
    ...commonTags.filter((t) => t.startsWith(partial.toLowerCase())),
    ...Array.from(tags).filter((t) => t.toLowerCase().startsWith(partial.toLowerCase())),
  ]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 15)
    .map((t) => ({ label: t, insertText: t, detail: `Tag: <${t}>` }));
}

// ============================================================================
// Token Detection Helpers
// ============================================================================

function isAfterToken(tokens: Token[], tokenValue: string, afterPunctuation: string): boolean {
  const foundToken = false;
  let foundPunctuation = false;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    if (token.value === afterPunctuation && !foundPunctuation) {
      foundPunctuation = true;
    } else if (token.value === tokenValue && foundPunctuation) {
      return true;
    } else if (token.value !== afterPunctuation) {
      break;
    }
  }
  return false;
}

function isAfterTokenValue(tokens: Token[], tokenValue: string, afterPunctuation: string): boolean {
  let foundDot = false;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    if (token.value === afterPunctuation) {
      foundDot = true;
    } else if (foundDot && token.type === 'identifier' && token.value === tokenValue) {
      return true;
    } else {
      break;
    }
  }
  return false;
}

function isAfterMethodCall(tokens: Token[], methodName: string): boolean {
  // Look for pattern: methodName(
  const foundMethod = false;
  let foundOpenParen = false;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    if (token.type === 'punctuation' && token.value === '(' && !foundOpenParen) {
      foundOpenParen = true;
    } else if (foundOpenParen && token.type === 'identifier' && token.value === methodName) {
      return true;
    } else if (!foundOpenParen) {
      break;
    }
  }
  return false;
}

function isAfterPunctuation(tokens: Token[], punctuation: string): boolean {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    return token.type === 'punctuation' && token.value === punctuation;
  }
  return false;
}

function isInsideString(tokens: Token[], methodName: string, quote: string): boolean {
  // Check if we're inside a string argument for a method call
  let depth = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'punctuation') {
      if (token.value === ')') depth++;
      else if (token.value === '(') {
        if (depth === 0) {
          // Found the method call opening
          if (i > 0 && tokens[i - 1].type === 'identifier' && tokens[i - 1].value === methodName) {
            // Now look for our quote
            for (let j = i + 1; j < tokens.length; j++) {
              if (tokens[j].type === 'string') return true;
              if (tokens[j].type === 'punctuation' && tokens[j].value === ')') break;
            }
          }
          break;
        }
        depth--;
      }
    }
  }
  return false;
}

function isInsideAttributeName(tokens: Token[]): boolean {
  // Look for pattern: [...attributeName without closing ]
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'punctuation' && token.value === '[') {
      return true;
    }
    if (token.type === 'punctuation' && token.value === ']') {
      break;
    }
  }
  return false;
}

function isAfterPseudoSelector(tokens: Token[]): boolean {
  const pseudoSelectors = [
    ':first-child',
    ':last-child',
    ':nth-child',
    ':hover',
    ':focus',
    ':active',
    ':visited',
    ':before',
    ':after',
  ];
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'identifier' && pseudoSelectors.some((p) => p.startsWith(token.value))) {
      return true;
    }
  }
  return false;
}

function isAfterStringInAttribute(tokens: Token[], prefix: string): boolean {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    if (token.type === 'string' && token.value.includes(prefix)) {
      return true;
    }
    if (token.type === 'punctuation' && token.value === '[') {
      break;
    }
  }
  return false;
}

function isAfterAxis(tokens: Token[]): boolean {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    return token.type === 'operator' && (token.value === '//' || token.value === '/');
  }
  return false;
}

function isAfterXPathAttribute(tokens: Token[]): boolean {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    if (token.type === 'punctuation' && token.value === '[') {
      // Look for @ after [
      for (let j = i + 1; j < tokens.length; j++) {
        const next = tokens[j];
        if (next.type === 'whitespace') continue;
        return next.type === 'operator' && next.value === '@';
      }
    }
    if (token.type === 'punctuation' && token.value === ']') {
      break;
    }
  }
  return false;
}

function isAfterXPathContainsAttribute(tokens: Token[]): boolean {
  // Look for contains(@...
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    if (token.type === 'identifier' && token.value.includes('contains')) {
      // Check if followed by (@
      for (let j = i + 1; j < tokens.length; j++) {
        const next = tokens[j];
        if (next.type === 'whitespace') continue;
        return next.type === 'operator' && next.value === '@';
      }
    }
    if (token.type === 'punctuation' && token.value === '[') {
      break;
    }
  }
  return false;
}

function isAfterXPathDataAttribute(tokens: Token[]): boolean {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'whitespace') continue;
    if (
      token.type === 'string' &&
      (token.value.includes('data-') || token.value.includes('@data-'))
    ) {
      return true;
    }
    if (token.type === 'operator' && token.value === '@') {
      // Check if preceded by contains(
      for (let j = i - 1; j >= 0; j--) {
        const prev = tokens[j];
        if (prev.type === 'whitespace') continue;
        if (prev.type === 'identifier' && prev.value.includes('contains')) {
          return true;
        }
        break;
      }
    }
    if (token.type === 'punctuation' && token.value === '[') {
      break;
    }
  }
  return false;
}

function isInsideXPathPredicateString(tokens: Token[]): boolean {
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i];
    if (token.type === 'punctuation' && token.value === '[') {
      break;
    }
    if (token.type === 'string') {
      return true;
    }
  }
  return false;
}

// PageElement type for type checking
interface PageElement {
  tag: string;
  id?: string;
  testId?: string;
  ariaLabel?: string;
  placeholder?: string;
  altText?: string;
  title?: string;
  text?: string;
  classes: string[];
  role?: string;
  name?: string;
}
