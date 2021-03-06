(function (definition) {
    if (typeof exports === "object") {
        // CommonJS
        module.exports = definition();
    } else if (typeof define === "function" && define.amd) {
        // RequireJS
        define(definition);
    } else {
        // <script>
        distlink = definition();
    }
})(function () {
    'use strict';

    function isArray(v) {
        return Array.isArray(v);
    }

    function isFunction(v) {
        return v && typeof v === "function";
    }

    function isInteger(value) {
        // refs: https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Number/isInteger
        return typeof value === 'number' &&
            isFinite(value) &&
            Math.floor(value) === value;
    };

    function isNullOrUndefined(v) {
        return v == null;
    }

    function isObject(v) {
        return v && !Array.isArray(v) && (typeof v) === "object";
    }

    function isPrimitive(v) {
        if (v == null) return false;
        var t = typeof v;
        return t === "string" || t === "number" || t === "boolean";
    }

    function isString(v) {
        return typeof v === "string";
    }

    function isEmptyString(v) {
        return isNullOrUndefined(v) || (isString(v) && v === "");
    }

    function isAttr(v) {
        return v && v.nodeType === Node.ATTRIBUTE_NODE;
    }

    function isElementNode(v) {
        return v && v.nodeType === Node.ELEMENT_NODE;
    }

    function isTextNode(v) {
        return v && v.nodeType === Node.TEXT_NODE;
    }

    function isInputFamily(v) {
        return v && (v.tagName === "INPUT" || v.tagName === "TEXTAREA" || v.tagName === "SELECT");
    }

    function isTerminalTag(v) {
        return v && (v.tagName === "INPUT" || v.tagName === "HR");
    }

    function removeChildren(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    }

    const ObjectLink = /** @lends ObjectLink */ function ObjectLink(parentLink, object) {

        this._selected = null;
        this._selectedRule = null;
        this._props = {};
        this._lastLink = null;

        if (parentLink == null) {
            // It's OK.
        }
        else if (parentLink.constructor !== this) {
            // TODO
        }

        if (!isObject(object)) {
            // TODO
        }

        this._parentLink = parentLink;
        this._object = object;

        for (let key in object) {
            if (!object.hasOwnProperty(key)) {
                continue;
            }
            this.put(key, object[key]);
        }
    }

    ObjectLink.prototype.put = function (key, value) {
        this._props[key] = new Prop(this, createLink(this, value), key);
    }

    ObjectLink.prototype.select = function (queryOrElement) {

        if (isString(queryOrElement)) {
            this._selected = document.querySelector(queryOrElement);
        }
        else if (isElementNode(queryOrElement)) {
            this._selected = queryOrElement;
        }
        else {
            throw Error("The queryOrElement requires query string or ElementNode.");
        }

        return this;
    };

    const Prop = /** @lends Prop */ function Prop(objectLink, link, key) {
        this._link = link;
        (function (object, link) {
            Object.defineProperty(object, key, {
                enumerable: true,
                get: function () {
                    return link.getValue();
                },
                set: function (value) {
                    link.setValue(value);
                },
            });
            Object.defineProperty(objectLink, key, {
                enumerable: true,
                get: function () {
                    objectLink._lastLink = link;
                    return link;
                },
            });
        })(objectLink._object, link);
    }

    ObjectLink.prototype.addFilter = function (filter) {
        if (!isFunction(filter)) {
            throw Error("The filter requires function.");
        }

        if (!this._lastLink) {
            throw Error("No previous link.");
        }

        if (!this._lastLink._lastPropagation) {
            throw Error("No previous propagation.");
        }

        this._lastLink._lastPropagation.addFilter(filter);

        return this;
    };

    const ArrayLink = /** @lends ArrayLink */ function ArrayLink(parentLink, array) {
        this._parentLink = parentLink;
        this._array = array;
        this._items = [];
        this._propagations = [];

        const arrayTmp = array.splice(0, array.length);

        for (let i = 0; i < arrayTmp.length; i++) {
            this.push(arrayTmp[i]);
        }
    }

    ArrayLink.prototype.push = function (value) {
        this._array.push(value);
        this._items.push(new Item(this, createLink(this, value), this._items.length));
        this.propagate();
        return this;
    }

    ArrayLink.prototype.remove = function (index, count) {

        // validations and aborts

        const items = this._items;

        if (items.length === 0) {
            return this;
        }

        if (!isInteger(index)) {
            return this;
        }

        if (index < 0 || items.length <= index) {
            return this;
        }

        if (isNullOrUndefined(count)) {
            count = 1;
        } else {
            if (!isInteger(count)) {
                return this;
            }
        }

        if (count <= 0) {
            return this;
        }

        //
        // process
        //

        // Confirm end index
        let end = index + count;
        if (end > items.length) {
            end = items.length;
        }

        // Call _destroy for each items
        for (let i = end - 1; i >= index; --i) {
            if (items[i]._destroy) {
                items[i]._destroy();
            }
        }

        // Release items
        items.splice(index, count);
        this._value.splice(index, count);

        // update item.index
        if (items.length > 0) {
            for (let i = index - 1; i < items.length; i++) {
                items[i].index = i;
            }
        }

        this.propagate();

        return this;
    };

    const Item = /** @lends Item */ function Item(arrayLink, link, index) {
        this._arrayLink = arrayLink;
        this._link = link;
        this.index = index;
        this._linkedElements = [];
    }

    Item.prototype.addLinkedElement = function (element) {
        this._linkedElements.push(element);
    };

    Item.prototype.propagate = function () {
        this._link.propagate();
    };

    Item.prototype._destroy = function () {
        this._link._destroy();
    };

    ArrayLink.prototype.select = function (queryOrElement) {

        if (isString(queryOrElement)) {
            this._selected = document.querySelector(queryOrElement);
        }
        else if (isElementNode(queryOrElement)) {
            this._selected = queryOrElement;
        }
        else {
            throw Error("The queryOrElement requires query string or ElementNode.");
        }

        return this;
    };

    /**
     * Registers an callback function that is called by propagation.
     * 
     * @name ArrayLink#each
     * @function
     * @param {eachCallback} callback Calls it back.
     */
    ArrayLink.prototype.each = function (callback) {

        if (!isFunction(callback)) {
            throw Error("The callback was not a function.");
        }

        if (!isElementNode(this._selected)) {
            throw Error("No ElementNode was selected.");
        }

        const propagation = new EachPropagation(this, this._selected, callback);
        propagation.propagate();
        this._propagations.push(propagation);

        return this._parentLink;
    };

    const EachPropagation = /** @lends EachPropagation */ function EachPropagation(arrayLink, element, callback) {
        this._arrayLink = arrayLink;
        this._element = element;
        this._callback = callback;
        this._firstElementChild = element.firstElementChild ? element.firstElementChild.cloneNode(true) : null;
        removeChildren(this._element);
        this._previousEachItemPropagations = [];
        this._filters = null;
    }

    EachPropagation.prototype.propagate = function () {

        const element = this._element;
        const previousEachItemPropagations = this._previousEachItemPropagations;

        // Clear previous appended elements
        for (let index = 0; index < previousEachItemPropagations.length; index++) {
            const previousEachItemPropagation = previousEachItemPropagations[index];
            if (previousEachItemPropagation._itemElement) {
                try {
                    element.removeChild(previousEachItemPropagation._itemElement);
                } catch (error) {
                    // ignore error                    
                }
            }
        }

        const items = this._arrayLink._items;
        const newEachItemPropagations = [];
        newEachItemPropagations.length = items.length;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Find previousEachItemPropagation that is having same item
            let index = -1;
            for (let j = 0; j < previousEachItemPropagations.length; j++) {
                const previousEachItemPropagation = previousEachItemPropagations[j];
                if (previousEachItemPropagation._item === item) {
                    index = j;
                    break;
                }
            }

            let eachItemPropagation = null;
            if (index >= 0) {
                // reuse previousEachItemPropagation if it's found
                eachItemPropagation = previousEachItemPropagations[index];
                // remove found previousEachItemPropagation to destroy unuse EachItemPropagation later
                previousEachItemPropagations.splice(index, 1);
            } else {
                // create EachItemPropagation if it's not found
                let itemElement = null;
                if (this._firstElementChild) {
                    itemElement = this._firstElementChild.cloneNode(true);
                }
                eachItemPropagation = new EachItemPropagation(this, item, itemElement);
            }

            // append a child element for the item
            const itemElement = eachItemPropagation._itemElement;
            if (itemElement) {
                element.appendChild(itemElement);
            }

            // keep eachItemPropagation to propagate later
            newEachItemPropagations[i] = eachItemPropagation;
        }

        // propagae eachItem
        for (let index = 0; index < newEachItemPropagations.length; index++) {
            const eachItemPropagation = newEachItemPropagations[index];
            eachItemPropagation.propagate();
        }

        // keep EachItemPropagations for next propagations
        this._previousEachItemPropagations = newEachItemPropagations;
    }

    const EachItemPropagation = /** @lends EachItemPropagation */ function EachItemPropagation(eachPropagation, item, itemElement) {
        this._eachPropagation = eachPropagation;
        this._item = item;
        this._itemElement = itemElement;
    }

    EachItemPropagation.prototype.propagate = function () {
        const ep = this._eachPropagation;
        const item = this._item;
        const link = this._item._link;
        const itemElement = this._itemElement;

        if (itemElement) {
            link.select(itemElement);
        }

        ep._callback.call(ep._arrayLink, link, itemElement, item.index, ep._element);
    }

    ArrayLink.prototype.propagate = function () {
        for (let i = 0; i < this._propagations.length; i++) {
            this._propagations[i].propagate();
        }
    }

    ArrayLink.prototype._destroy = function () {
        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            if (propagation._destroy) {
                propagation._destroy();
            }
        }
        const items = this._items;
        for (let index = 0; index < items.length; index++) {
            items[index]._destroy();
        }
    };

    const PrimLink = /** @lends PrimLink */ function PrimLink(parentLink, value) {
        this._parentLink = parentLink;
        this._previousValue = undefined;
        this._value = value;
        this._propagations = [];
        this._lastPropagation = null;
    }

    PrimLink.prototype.getValue = function () {
        return this._value;
    }

    PrimLink.prototype.setValue = function (value) {
        if (this._value !== value) {
            this._previousValue = this._value;
            this._value = value;
            this._propagate();
        }
    }

    PrimLink.prototype.select = function (queryOrElement) {

        if (isString(queryOrElement)) {
            let scopeNode = this._parentLink._selected || document;
            this._selected = scopeNode.querySelector(queryOrElement);
        }
        else if (isElementNode(queryOrElement)) {
            this._selected = queryOrElement;
        }
        else {
            throw Error("The queryOrElement requires query string or ElementNode.");
        }

        return this;
    };

    PrimLink.prototype.withValue = function (eventType) {

        if (isNullOrUndefined(eventType)) {
            eventType = "change";
        }

        // It adds a single event listener for an event among number of inputs.
        // The listener delivers the value of event target to other inputs and
        // property value of related object. 

        const input = this._assertSelected();

        // if (!isElementNode(this._selected)) {
        //   throw Error("No ElementNode was selected.");
        // }

        if (!isInputFamily(input)) {
            throw Error("Selected NodeElement was not an input, select nor textarea.");
        }

        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            // We don't create WithValuePropagation twice that has same input and eventType.
            if (propagation.constructor === WithValuePropagation
                && propagation._input === input
                && propagation._eventType === eventType
            ) {
                propagation.propagate();
                this._lastPropagation = propagation;
                return this._parentLink;
            }
        }

        const propagation = new WithValuePropagation(this, input, eventType);
        propagation.propagate();
        propagations.push(propagation);
        this._lastPropagation = propagation;
        return this._parentLink;
    }

    const WithValuePropagation = /** @lends WithValuePropagation */ function WithValuePropagation(primLink, input, eventType) {
        this._primLink = primLink;
        this._input = input;
        this._eventType = eventType;
        this._handling = false;
        this._listener = (function (self) {
            return function (event) {
                self._handling = true;
                self._primLink.setValue(event.target.value);
                self._handling = false;
            };
        })(this);
        input.addEventListener(eventType, this._listener);
        this._filters = null;
    }

    WithValuePropagation.prototype.addFilter = function (filter) {
        if (!this._filters) {
            this._filters = [];
        }
        this._filters.push(filter);
        this.propagate();
    }

    WithValuePropagation.prototype.propagate = function () {
        if (!this._handling) {
            this._input.value = this._primLink._value;
        }
    }

    WithValuePropagation.prototype._destroy = function () {
        this._input.removeEventListener(this._eventType, this._listener);
    }

    PrimLink.prototype.toText = function () {
        const element = this._assertSelected();
        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            // We don't create ToTextPropagation twice that has same element.
            if (propagation.constructor === ToTextPropagation && propagation._element === element) {
                propagation.propagate();
                this._lastPropagation = propagation;
                return this._parentLink;
            }
        }

        const propagation = new ToTextPropagation(this, element);
        propagation.propagate();
        propagations.push(propagation);
        this._lastPropagation = propagation;
        return this._parentLink;
    }

    const ToTextPropagation = /** @lends ToTextPropagation */ function ToTextPropagation(primLink, element) {
        this._primLink = primLink;
        this._element = element;
        this._filters = null;
    }

    ToTextPropagation.prototype.addFilter = function (filter) {
        if (!this._filters) {
            this._filters = [];
        }
        this._filters.push(filter);
        this.propagate();
    }

    ToTextPropagation.prototype.propagate = function () {
        let value = this._primLink._value;
        if (this._filters) {
            for (let i = 0; i < this._filters.length; i++) {
                const filter = this._filters[i];
                value = filter(value);
            }
        }
        this._element.textContent = value;
    }

    PrimLink.prototype.toHtml = function () {
        const element = this._assertSelected();
        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            // We don't create ToHtmlPropagation twice that has same element.
            if (propagation.constructor === ToHtmlPropagation && propagation._element === element) {
                propagation.propagate();
                this._lastPropagation = propagation;
                return this._parentLink;
            }
        }

        const propagation = new ToHtmlPropagation(this, element);
        propagation.propagate();
        propagations.push(propagation);
        this._lastPropagation = propagation;
        return this._parentLink;
    }

    const ToHtmlPropagation = /** @lends ToHtmlPropagation */ function ToHtmlPropagation(primLink, element) {
        this._primLink = primLink;
        this._element = element;
        this._filters = null;
    }

    ToHtmlPropagation.prototype.addFilter = function (filter) {
        if (!this._filters) {
            this._filters = [];
        }
        this._filters.push(filter);
        this.propagate();
    }

    ToHtmlPropagation.prototype.propagate = function () {
        let value = this._primLink._value;
        if (this._filters) {
            for (let i = 0; i < this._filters.length; i++) {
                const filter = this._filters[i];
                value = filter(value);
            }
        }
        this._element.innerHTML = value;
    }

    PrimLink.prototype.toSrc = function () {
        return this.toAttr("src");
    }

    PrimLink.prototype.toHref = function () {
        return this.toAttr("href");
    }

    PrimLink.prototype.toAttr = function (attrName) {
        const element = this._assertSelected();
        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            // We don't create ToAttrPropagation twice that has same element and attrName.
            if (propagation.constructor === ToAttrPropagation
                && propagation._element === element
                && propagation._attrName === attrName) {
                propagation.propagate();
                this._lastPropagation = propagation;
                return this._parentLink;
            }
        }

        const propagation = new ToAttrPropagation(this, element, attrName);
        propagation.propagate();
        propagations.push(propagation);
        this._lastPropagation = propagation;
        return this._parentLink;
    };

    const ToAttrPropagation = /** @lends ToAttrPropagation */ function ToAttrPropagation(primLink, element, attrName) {
        this._primLink = primLink;
        this._element = element;
        this._attrName = attrName;
        this._filters = null;
    }

    ToAttrPropagation.prototype.addFilter = function (filter) {
        if (!this._filters) {
            this._filters = [];
        }
        this._filters.push(filter);
        this.propagate();
    }

    ToAttrPropagation.prototype.propagate = function () {
        let value = this._primLink._value;
        if (this._filters) {
            for (let i = 0; i < this._filters.length; i++) {
                const filter = this._filters[i];
                value = filter(value);
            }
        }
        this._element.setAttribute(this._attrName, value);
    }

    PrimLink.prototype.toClass = function () {
        const element = this._assertSelected();
        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            // We don't create ToClassPropagation twice that has same element.
            if (propagation.constructor === ToClassPropagation
                && propagation._element === element) {
                propagation.propagate();
                this._lastPropagation = propagation;
                return this._parentLink;
            }
        }

        const propagation = new ToClassPropagation(this, element);
        propagation.propagate();
        propagations.push(propagation);
        this._lastPropagation = propagation;
        return this._parentLink;
    };

    const ToClassPropagation = /** @lends ToClassPropagation */ function ToClassPropagation(primLink, element) {
        this._primLink = primLink;
        this._element = element;
        this._previousValue = "";
        this._filters = null;
    }

    ToClassPropagation.prototype.addFilter = function (filter) {
        if (!this._filters) {
            this._filters = [];
        }
        this._filters.push(filter);
        this.propagate();
    }

    ToClassPropagation.prototype.propagate = function () {
        const classList = this._element.classList;
        const previousValue = this._previousValue;
        if (!isEmptyString(previousValue)) {
            classList.remove(previousValue);
        }
        let value = this._primLink._value;
        if (this._filters) {
            for (let i = 0; i < this._filters.length; i++) {
                const filter = this._filters[i];
                value = filter(value);
            }
        }
        if (!isEmptyString(value)) {
            classList.add(value);
        }
        this._previousValue = value;
    }

    PrimLink.prototype.turnClassOn = function (className) {
        return this.turnClass(className, true);
    }

    PrimLink.prototype.turnClassOff = function (className) {
        return this.turnClass(className, false);
    }

    PrimLink.prototype.turnClass = function (className, onOrOff) {
        const element = this._assertSelected();
        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            // We don't create TurnClassPropagation twice 
            // that has same element, className and onOrOff.
            if (propagation.constructor === TurnClassPropagation
                && propagation._element === element
                && propagation._className === className
                && propagation._onOrOff === !!onOrOff) {
                propagation.propagate();
                this._lastPropagation = propagation;
                return this._parentLink;
            }
        }

        const propagation = new TurnClassPropagation(this, element, className, onOrOff);
        propagation.propagate();
        propagations.push(propagation);
        this._lastPropagation = propagation;
        return this._parentLink;
    };

    const TurnClassPropagation = /** @lends TurnClassPropagation */ function TurnClassPropagation(primLink, element, className, onOrOff) {
        this._primLink = primLink;
        this._element = element;
        this._className = className;
        this._onOrOff = !!onOrOff;
        this._filters = null;
    }

    TurnClassPropagation.prototype.addFilter = function (filter) {
        if (!this._filters) {
            this._filters = [];
        }
        this._filters.push(filter);
        this.propagate();
    }

    TurnClassPropagation.prototype.propagate = function () {
        let value = this._primLink._value;
        if (this._filters) {
            for (let i = 0; i < this._filters.length; i++) {
                const filter = this._filters[i];
                value = filter(value);
            }
        }
        const on = this._onOrOff ? value : !value;
        if (on) {
            this._element.classList.add(this._className);
        } else {
            this._element.classList.remove(this._className);
        }
    }

    PrimLink.prototype._assertSelected = function () {

        const selected = this._selected;

        if (!isElementNode(selected)) {
            throw Error("No ElementNode was selected.");
        }

        return selected;
    };

    PrimLink.prototype.selectRule = function (rule) {

        if (rule.constructor !== CSSStyleRule) {
            throw Error("The argument rule was not CSSStyleRule.");
        }

        if (rule.type !== CSSRule.STYLE_RULE) {
            throw Error("The CSSRule type was not STYLE_RULE.");
        }

        this._rule = rule;

        return this;
    };

    //TODO Change method name
    PrimLink.prototype.toStyleOf = function (styleName) {
        const rule = this._assertRuleAreSelected();
        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            // We don't create ToStyleOfPropagation twice 
            // that has same rule and styleName.
            if (propagation.constructor === ToStyleOfPropagation
                && propagation._rule === rule
                && propagation._styleName === styleName) {
                propagation.propagate();
                this._lastPropagation = propagation;
                return this._parentLink;
            }
        }

        const propagation = new ToStyleOfPropagation(this, rule, styleName);
        propagation.propagate();
        propagations.push(propagation);
        this._lastPropagation = propagation;
        return this._parentLink;
    }

    PrimLink.prototype._assertRuleAreSelected = function () {
        const rule = this._rule;
        if (isNullOrUndefined(rule)) {
            throw Error("No CSSStyleRule were selected.");
        }
        return rule;
    };

    const ToStyleOfPropagation = /** @lends ToStyleOfPropagation */ function ToStyleOfPropagation(primLink, rule, styleName) {
        this._primLink = primLink;
        this._rule = rule;
        this._styleName = styleName;
        this._filters = null;
    }

    ToStyleOfPropagation.prototype.addFilter = function (filter) {
        if (!this._filters) {
            this._filters = [];
        }
        this._filters.push(filter);
        this.propagate();
    }

    ToStyleOfPropagation.prototype.propagate = function () {
        let value = this._primLink._value;
        if (this._filters) {
            for (let i = 0; i < this._filters.length; i++) {
                const filter = this._filters[i];
                value = filter(value);
            }
        }
        this._rule.style[this._styleName] = value;
    }

    PrimLink.prototype._propagate = function () {
        for (let i = 0; i < this._propagations.length; i++) {
            this._propagations[i].propagate();
        }
    }

    PrimLink.prototype._destroy = function () {
        const propagations = this._propagations;
        for (let i = 0; i < propagations.length; i++) {
            const propagation = propagations[i];
            if (propagation._destroy) {
                propagation._destroy();
            }
        }
    };

    function createLink(parentLink, value) {
        let link;

        if (isNullOrUndefined(value) || isPrimitive(value)) {
            link = new PrimLink(parentLink, value);
        }
        else if (isObject(value)) {
            link = new ObjectLink(parentLink, value);
        }
        else if (isArray(value)) {
            link = new ArrayLink(parentLink, value);
        }
        else {
            throw Error("The type of value is not supported by ObjectLink");
        }

        return link;
    }

    /** 
     * Create a new ObjectLink
     * 
     * @function    distlink
     * @param       {object}    object  It is to be an ObjectLink
     * @returns     {ObjectLink}        Created ObjectLink
     */
    const distlink = /** @lends distlink  */ function distlink(object) {
        return createLink(null, object);
    }

    return distlink;
});

