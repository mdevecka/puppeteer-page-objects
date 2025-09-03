import { Page, KeyInput, KeyPressOptions } from 'puppeteer';

export class ObjectContext {

  constructor(readonly page: Page, readonly selectorList: ReadonlyArray<string>) {
  }

  createChild(selector: string) {
    const selectorList = [...this.selectorList, selector];
    return new ObjectContext(this.page, selectorList);
  }

  createElement(index: number) {
    const selectorList = Array.from(this.selectorList);
    selectorList[selectorList.length - 1] += `:nth-child(${index + 1})`;
    return new ObjectContext(this.page, selectorList);
  }

}

export abstract class PageObject {

  get selector() { return this.ctx.selectorList.join(' '); }
  get element() { return this.ctx.page.$(this.selector); }
  get visible() { return this.element.then(e => e?.isVisible() ?? false); }
  get focused() { return this.tryEval(e => document.activeElement === e) ?? false; }
  get classList() { return this.tryEval(e => Array.from(e.classList)); }
  get attributeNames() { return this.tryEval(e => e.getAttributeNames()); }
  get disabled() { return this.hasAttribute('disabled'); }

  constructor(protected ctx: ObjectContext) {
  }

  eval<T, P extends unknown[]>(func: (e: Element, ...args: P) => T, ...args: P) {
    return this.ctx.page.$eval(this.selector, func as any, ...args) as Promise<T>;
  }

  tryEval<T, P extends unknown[]>(func: (e: Element, ...args: P) => T, ...args: P) {
    return this.eval(func, ...args).catch(() => null as T);
  }

  evalMany<T, P extends unknown[]>(func: (e: Element[], ...args: P) => T, ...args: P) {
    return this.ctx.page.$$eval(this.selector, func as any, ...args) as Promise<T>;
  }

  tryEvalMany<T, P extends unknown[]>(func: (e: Element[], ...args: P) => T, ...args: P) {
    return this.evalMany(func, ...args).catch(() => null as T);
  }

  hover() { return this.element.then(e => e.hover()); }

  hasClass(name: string) {
    return this.tryEval((e, name) => e.classList.contains(name), name);
  }

  hasAttribute(name: string) {
    return this.tryEval((e, name) => e.hasAttribute(name), name);
  }

  protected createChild<T>(type: { new(ctx: ObjectContext): T }, selector: string) {
    const ctx = this.ctx.createChild(selector);
    return new type(ctx);
  }

  protected createElement<T>(type: { new(ctx: ObjectContext): T }, index: number) {
    const ctx = this.ctx.createElement(index);
    return new type(ctx);
  }

  protected createList<T>(type: { new(ctx: ObjectContext): T }, selector: string) {
    return new ObjectList(type, this.ctx.createChild(selector));
  }

}

export class ObjectList<T> extends PageObject {

  get length() { return this.evalMany((e: Element[]) => e.length); }

  get(index: number) {
    return this.createElement(this.type, index);
  }

  async map<S>(func: (obj: T) => Promise<S>) {
    const length = await this.length;
    const res: Promise<S>[] = [];
    for (let i = 0; i < length; i++) {
      res.push(func(this.get(i)));
    }
    return Promise.all(res);
  }

  constructor(private type: { new(ctx: ObjectContext): T }, ctx: ObjectContext) {
    super(ctx);
  }

}

export class TextObject extends PageObject {

  get text() { return this.tryEval((e: HTMLElement) => e.innerText); }

}

export class ButtonObject extends PageObject {

  get text() { return this.tryEval((e: HTMLElement) => e.innerText); }

  click() { return this.element.then(e => e.click()); }

}

export class CheckboxObject extends PageObject {

  get checked() { return this.eval((e: HTMLInputElement) => e.checked); }

  click() { return this.element.then(e => e.click()); }

  focus() { return this.element.then(e => e.focus()); }

}

export class RadioButtonObject extends CheckboxObject {
}

export class DropdownObject extends PageObject {

  get selectedIndex() { return this.eval((e: HTMLSelectElement) => e.selectedIndex); }
  get value() { return this.eval((e: HTMLSelectElement) => e.value); }
  get text() { return this.eval((e: HTMLSelectElement) => e.options[e.selectedIndex].text); }
  get options() { return this.eval((e: HTMLSelectElement) => Array.from(e.options).map(e => [e.text, e.value] as const)); }

  focus() { return this.element.then(e => e.focus()); }

  click() { return this.element.then(e => e.click()); }

  select(value: string) { return this.element.then(e => e.select(value)); }

  async selectByText(text: string) {
    const opt = (await this.options).find(opt => opt[0] === text);
    if (opt == null)
      throw new Error(`option '${text}' not found`);
    return this.element.then(e => e.select(opt[1]));
  }

}

export class TextInputObject extends PageObject {

  get text() { return this.tryEval((e: HTMLInputElement) => e.value); }
  get readonly() { return this.hasAttribute('readonly'); }
  get touched() { return this.hasClass('ng-touched'); }
  get dirty() { return this.hasClass('ng-dirty'); }
  get valid() { return this.hasClass('ng-valid'); }
  get invalid() { return this.hasClass('ng-invalid'); }

  press(key: KeyInput, options?: Readonly<KeyPressOptions>) { return this.element.then(e => e.press(key, options)); }

  type(text: string) { return this.element.then(e => e.type(text)); }

  focus() { return this.element.then(e => e.focus()); }

}

export class TextAreaObject extends TextInputObject {
}
