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

    /** 
     * Create a new ObjectLink
     * 
     * @function    distlink
     * @param       {object}    object  It is to be an ObjectLink
     * @returns     {ObjectLink}        Created ObjectLink
     */
    const distlink = /** @lends distlink  */ function distlink(object) {
        return loadObjectLinkByObject(null, null, object);
    }

    const _ridDic = {};

    distlink.endsWithPred = function (key) {
        return (function (key) {
            return function (target) {
                if (!isString(target)) { return false; }
                const index = target.indexOf(key);
                return index >= 0 && index === (target.length - key.length);
            };
        })(key);
    };

    distlink.csvContainsPred = function (key) {
        return (function (key) {
            return function (target) {
                if (!isString(target)) { return false; }
                return target.split(/\s*,\s*/g).indexOf(key) >= 0;
            };
        })(key);
    };

    function loadObjectLinkByObject(owner, nameInOwner, object) {
        if (!isObject(object)) {
            throw Error("The argument type was not an object.");
        }

        if (object._rid) {
            return _ridDic[object._rid];
        }

        const _rid = defineRidProp(object);
        const prop = new ObjectLink(owner, nameInOwner, null, null, object);
        _ridDic[_rid] = prop;

        return prop;
    }

    function loadArrayLinkByObject(owner, nameInOwner, array) {
        if (!isArray(array)) {
            throw Error("The argument type was not an array.");
        }

        if (array._rid) {
            return _ridDic[array._rid];
        }

        const _rid = defineRidProp(array);
        const prop = new ArrayLink(owner, nameInOwner, null, null, array);
        _ridDic[_rid] = prop;

        return prop;
    }

    function loadObjectLinkByArray(owner, indexAtOwner, object) {
        if (!isObject(object)) {
            throw Error("The argument type was not an object.");
        }

        if (object._rid) {
            return _ridDic[object._rid];
        }

        const _rid = defineRidProp(object);
        const objectLink = new ObjectLink(null, null, owner, indexAtOwner, object);
        _ridDic[_rid] = objectLink;

        return objectLink;
    }

    function loadArrayLinkByArray(owner, indexAtOwner, array) {
        if (!isArray(array)) {
            throw Error("The argument type was not an array.");
        }

        if (array._rid) {
            return _ridDic[array._rid];
        }

        const _rid = defineRidProp(array);
        const arrayLink = new ArrayLink(null, null, owner, indexAtOwner, array);
        _ridDic[_rid] = arrayLink;

        return arrayLink;
    }

    function defineRidProp(target) {

        let _rid = rid();

        while (_ridDic[_rid]) {
            _rid = rid();
        }

        Object.defineProperty(target, "_rid", {
            enumerable: false,
            writable: false,
            value: _rid
        });

        return _rid;
    }

    var RID_MIN = 100000000000000;
    var RID_MAX = RID_MIN * 10 - 1;

    function rid() {
        return "_" + (Math.floor(Math.random() * (RID_MAX - RID_MIN + 1)) + RID_MIN).toString(10);
    }

    /**
     * Creates a new ObjectLink.
     * 
     * @class ObjectLink
     * @param   {?object}       owner           An object that has a property of object.
     * @param   {?string}       nameInOwner     Property name that has the object.
     * @param   {?ArrayLink}    arrayLink       An ArrayLink that has an item of primitive value
     * @param   {?number}       indexAtArray    Index at the original array for ArrayObjec
     * @param   {object}        object          The value of property.
     */
    const ObjectLink = /** @lends ObjectLink */ function ObjectLink(owner, nameInOwner, arrayLink, indexAtArray, object) {
        this._owner = owner;
        this._nameInOwner = nameInOwner;
        /** @member {Object} Original object */
        this._object = object;
        this._selected = null;
        this._propDic = {};
        this._and = null;

        Object.defineProperty(this, "and", {
            enumerable: false,
            get: (function (self) {
                return function () {
                    return self._and;
                };
            })(this)
        });

        // Create xxxLink for each properties
        for (let key in object) {
            const value = object[key];
            let prop;
            if (isNullOrUndefined(value) || isPrimitive(value)) {
                prop = new PrimitiveLink(this, key, null, null);
            }
            else if (isObject(value)) {
                prop = loadObjectLinkByObject(object, key, value);
            }
            else if (isArray(value)) {
                prop = loadArrayLinkByObject(this, key, value);
            }
            else {
                throw Error("Unsupported type");
            }
            this._propDic[key] = prop;

            // Define property of xxxLink to this 
            (function (self, key, prop) {
                Object.defineProperty(self, key, {
                    enumerable: true,
                    get: function () {
                        self._and = prop;
                        return prop;
                    }
                });
            })(this, key, prop);
        }

        // Create getter/setter for original object
        if (isObject(this._owner) && isString(nameInOwner)) {
            (function (self) {
                Object.defineProperty(self._owner, nameInOwner, {
                    enumerable: true,
                    get: function () {
                        return self._object;
                    },
                    set: function (value) {
                        if (isNullOrUndefined(value)) {
                            for (let key in self._propDic) {
                                self._propDic[key]._propagate(self, null);
                            }
                        }
                        else if (isObject(value)) {
                            for (let key in self._propDic) {
                                self._propDic[key]._propagate(self, value[key]);
                            }
                        }
                        else {
                            throw Error("Value type was unmatch");
                        }
                    }
                });
            })(this);
        }
    };

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

    ObjectLink.prototype._propagate = function (source, value) {

        if (source === this) {
            return;
        }

        if (isNullOrUndefined(value)) {
            for (let key in this._propDic) {
                this._propDic[key]._propagate(this, null);
            }
        }
        else if (isObject(value)) {
            for (let key in this._propDic) {
                this._propDic[key]._propagate(this, value[key]);
            }
        }
        else {
            throw Error("Value type was unmatch");
        }
    }

    ObjectLink.prototype._destroy = function () {

        const keys = Object.keys(this._propDic);
        for (let i = 0; i < keys.length; ++i) {
            this._propDic[keys[i]]._destroy();
        }

        return this;
    };

    /**
     * Creates a new ArrayLink.
     * 
     * @class ArrayLink
     * @param   {ObjectLink}    objectLink      An ObjectLink that has a property of array
     * @param   {string}        nameInObject    Property name that has the array
     * @param   {ArrayLink}     arrayLink       An ArrayLink that has an item of primitive value
     * @param   {number}        indexAtArray    Index at the original array for ArrayObjec
     * @param   {array}         array           The array to be linked.
     */
    const ArrayLink = /** @lends ArrayLink */ function ArrayLink(objectLink, nameInObject, arrayLink, indexAtArray, array) {

        /** @member {array} Original array */
        this._value = array;

        if (objectLink) {
            this._objectLink = objectLink;
            this._nameInObject = nameInObject;

            Object.defineProperty(this._objectLink._object, this._nameInObject, {
                enumerable: true,
                get: (function (self) {
                    return function () {
                        return self._value;
                    };
                })(this),
                set: (function (self) {
                    return function (value) {
                        self._value = value;
                        self._propagate(self, value);
                    };
                })(this),
            });
        }
        else if (arrayLink) {
            this._arrayLink = arrayLink;
            this._indexAtArray = indexAtArray;
        }

        if (isNullOrUndefined(objectLink._object[nameInObject])) {
            this._previousValue = "";
        } else {
            this._previousValue = "" + objectLink._object[nameInObject];
        }
        /** @member {array} XxxLiks for items in this._value array */
        this.links = [];

        // Create xxxLink for each items
        for (let i = 0; i < this._value.length; ++i) {
            const item = this._value[i];
            this._itemToXxxLink(i, item);
        }

        this._selected = null;

        // Holding contents are:
        // {
        //    callback: <function>,
        //    selectedElement: <ElementNode>
        // }
        this._eachContexts = [];
    }

    ArrayLink.prototype.append = function (item) {

        this._value.push(item);
        this._itemToXxxLink(this._value.length - 1, item);

        return this;
    }

    ArrayLink.prototype._itemToXxxLink = function (index, item) {

        let xxxLink;
        if (isNullOrUndefined(item) || isPrimitive(item)) {
            xxxLink = new PrimitiveLink(null, null, this, index);
        }
        else if (isObject(item)) {
            xxxLink = loadObjectLinkByArray(this, index, item);
        }
        else if (isArray(item)) {
            xxxLink = loadArrayLinkByArray(this, index, item);
        }
        else {
            throw Error("Unsupported type");
        }

        this.links.push(xxxLink);

        return this;
    }

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
     * This callback is called by each items in the array when ArrayLink propagates its items.
     * It is cloned automatically that if the selected element has a child element.
     * 
     * @callback eachCallback
     * @param {*}           item            An item that is one of in the array.
     *                                      The type of item is ObjectLink if the type of original item is an object.
     * @param {?element}    childElement    A cloned element that is first child elemet under the selected element.
     *                                      It will be null if the selected element has no child element.
     * @param {number}      index           The index is integer of iteration over the array. It begins from zero.
     * @param {element}     parentElement   The selected element.
     * @return {*}                          Breaks the iteratoin if you returns false.
     */

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

        const context = {
            callback: callback,
            selectedElement: this._selected,
            firstElementChild: this._selected.firstElementChild ? this._selected.firstElementChild.cloneNode(true) : null,
            childElements: [],
        };

        removeChildren(context.selectedElement);

        this._eachContexts.push(context);

        this._propagate(null, this._value);

        return this._objectLink;
    };

    ArrayLink.prototype._propagate = function (source, value) {

        if (source !== this && this._value !== value) {
            this._value = value;
        }

        for (let i = 0; i < this._eachContexts.length; ++i) {
            const context = this._eachContexts[i];
            for (let j = 0; j < this.links.length; ++j) {
                this._propagateItem(this, j, value[j]);
            }
        }
    };

    ArrayLink.prototype._propagateItem = function (source, index, value) {

        if (!isInteger(index)) {
            throw Error("The index was not integer.")
        }

        if (index < 0) {
            throw Error("The index was negative.")
        }

        if (index >= this.links.length) {
            throw Error("The index was out of range.")
        }

        const xxxLink = this.links[index];

        if (source !== xxxLink) {
            xxxLink._propagate(source, value);
        }

        for (let i = 0; i < this._eachContexts.length; ++i) {
            const context = this._eachContexts[i];

            // Create and fill child element array if length of child element array is less than index
            while (context.childElements.length <= index) {
                let childElement;
                if (context.childElements.length === index) {
                    if (context.firstElementChild) {
                        childElement = context.firstElementChild.cloneNode(true);
                        context.selectedElement.appendChild(childElement);
                    }
                    else {
                        childElement = null;
                    }
                } else {
                    childElement = null;
                }
                context.childElements.push(childElement);
            }

            let childElement = context.childElements[index];

            if (childElement) {
                xxxLink.select(childElement);
            }

            context.callback.call(this, xxxLink, childElement, index, context.selectedElement);
        }

    };

    ArrayLink.prototype.remove = function (index, count) {

        // validations and aborts

        if (this.links.length === 0) {
            return this;
        }

        if (!isInteger(index)) {
            return this;
        }

        if (index < 0 || this.links.length <= index) {
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
        if (end > this.links.length) {
            end = this.links.length;
        }

        // Call _destroy for each items
        for (let i = end - 1; i >= 0; --i) {
            if (this.links[i]._destroy) {
                this.links[i]._destroy();
            }
        }

        // Remove relational elements
        for (let i = 0; i < this._eachContexts.length; ++i) {
            const context = this._eachContexts[i];
            const removingElements = context.childElements.splice(index, end);
            for (let j = removingElements.length - 1; j >= 0; --j) {
                const removingElement = removingElements[j];
                if (removingElement) {
                    context.selectedElement.removeChild(removingElement);
                }
            }
        }

        // Release items
        this.links.splice(index, count);
        this._value.splice(index, count);

        return this;
    };

    ArrayLink.prototype._destroy = function () {
        this.remove(0, this.links.length);
        return this;
    }

    /**
     * Creates a new PrimitiveLink.
     * 
     * @class PrimitiveLink
     * @param {ObjectLink} objectLink An ObjectLink that has a property of primitive value
     * @param {string} nameInObject Property name that has the ObjectLink
     * @param {ArrayLink} arrayLink An ArrayLink that has an item of primitive value
     * @param {number} indexAtArray Index at the original array for ArrayObjec
     */
    const PrimitiveLink = /** @lends PrimitiveLink */ function PrimitiveLink(objectLink, nameInObject, arrayLink, indexAtArray) {
        this._objectLink = objectLink;
        this._nameInObject = nameInObject;
        this._arrayLink = arrayLink;
        this._indexAtArray = indexAtArray;

        if (this._objectLink) {
            this._value = this._objectLink._object[this._nameInObject];

            const getter = (function (self) {
                return function () {
                    return self._value;
                };
            })(this);

            const setter = (function (self) {
                return function (value) {
                    self._value = value;
                    self._propagate(self, value);
                };
            })(this);

            Object.defineProperty(objectLink._object, nameInObject, {
                enumerable: true,
                get: getter,
                set: setter,
            });

            /** @property {(boolean|number|string)} value Accessor of associated property value */
            Object.defineProperty(this, "value", {
                enumerable: false,
                get: getter,
                set: setter,
            });
        }
        else if (this._arrayLink) {
            this._value = this._arrayLink._value[this._indexAtArray];
        }

        if (isNullOrUndefined(objectLink._object[nameInObject])) {
            this._previousValue = "";
        } else {
            this._previousValue = "" + objectLink._object[nameInObject];
        }
        this._selected = null;
        this._rules = null;

        // Holding contents are:
        // key = eventType
        // value = {
        //    listener: <function>,
        //    inputs: [<input>]
        // }
        this._listenerContexts = {};

        // Holding contents are:
        //    [<ElementNode>]
        this._toTextElements = [];

        // Holding contents are:
        // key = attrName
        // value = {
        //    attrName: <attrName:string>,
        //    elements: [<ElementNode>]
        // }
        this._toAttrContexts = {};

        // Holding contents are:
        //    <ElementNode>
        this._toClassElements = [];

        // Holding contents are:
        // key = className + ("_on" | "_off")
        // value = {
        //    className: <className:string>,
        //    onOrOff: <onOrOff:boolean>,
        //    elements: [<ElementNode>]
        // }
        this._turnClassContexts = {};

        // Holding contents are:
        // [
        //    {
        //      rule: <CSSStyleRule>,
        //      styleName: <styleName:String>
        //    }
        // ]
        this._toStyleOfRuleAndStyleNames = [];

    };

    PrimitiveLink.prototype._assertSelected = function () {

        const selected = this._selected;

        if (!isElementNode(selected)) {
            throw Error("No ElementNode was selected.");
        }

        return selected;
    };

    PrimitiveLink.prototype.select = function (queryOrElement) {

        if (isString(queryOrElement)) {
            let scopeNode = this._objectLink._selected || document;
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

    PrimitiveLink.prototype.withValue = function (eventType) {

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

        let context = this._listenerContexts[eventType];
        if (isNullOrUndefined(context)) {
            context = {
                listener: (function (self) {
                    return function (event) {
                        self._propagate(event.target, event.target.value);
                    };
                })(this),
                inputs: [],
            };
            this._listenerContexts[eventType] = context;
        }

        // const input = this._selected;
        const index = context.inputs.indexOf(input);

        // The input of argument has been bound.
        if (index >= 0) {
            return this._objectLink;
        }

        context.inputs.push(input);
        input.value = this._value;
        input.addEventListener(eventType, context.listener);

        return this._objectLink;
    }

    PrimitiveLink.prototype.toText = function () {

        const element = this._assertSelected();

        const index = this._toTextElements.indexOf(element);

        // The input of argument has been bound.
        if (index >= 0) {
            return this._objectLink;
        }

        this._toTextElements.push(element);
        element.textContent = this._value;

        return this._objectLink;
    }

    PrimitiveLink.prototype.toSrc = function () {
        return this.toAttr("src");
    }

    PrimitiveLink.prototype.toHref = function () {
        return this.toAttr("href");
    }

    PrimitiveLink.prototype.toAttr = function (attrName) {

        const element = this._assertSelected();

        let context = this._toAttrContexts[attrName];
        if (isNullOrUndefined(context)) {
            context = {
                attrName: attrName,
                elements: []
            }
            this._toAttrContexts[attrName] = context;
        }

        const index = context.elements.indexOf(element);

        // The input of argument has been bound.
        if (index >= 0) {
            return;
        }

        context.elements.push(element);
        element.setAttribute(attrName, this._value);

        return this._objectLink;
    };

    PrimitiveLink.prototype.toClass = function () {

        const element = this._assertSelected();

        const index = this._toClassElements.indexOf(element);

        // The input of argument has been bound.
        if (index >= 0) {
            return;
        }

        this._toClassElements.push(element);
        if (!isEmptyString(this._value)) {
            element.classList.add(this._value);
        }

        return this._objectLink;
    };

    PrimitiveLink.prototype.turnClassOn = function (className) {
        return this.turnClass(className, true);
    }

    PrimitiveLink.prototype.turnClassOff = function (className) {
        return this.turnClass(className, false);
    }

    PrimitiveLink.prototype.turnClass = function (className, onOrOff) {

        const element = this._assertSelected();

        const key = className + "_" + (onOrOff ? "on" : "off");

        let context = this._turnClassContexts[key];
        if (isNullOrUndefined(context)) {
            context = {
                className: className,
                onOrOff: onOrOff,
                elements: []
            }
            this._turnClassContexts[key] = context;
        }

        const index = context.elements.indexOf(element);

        // The input of argument has been bound.
        if (index >= 0) {
            return this._objectLink;
        }

        context.elements.push(element);
        const on = context.onOrOff ? this._value : !this._value;
        if (on) {
            element.classList.add(context.className);
        } else {
            element.classList.remove(context.className);
        }

        return this._objectLink;
    };

    PrimitiveLink.prototype.selectRule = function (rule) {
        const rules = [];

        if (rule.constructor !== CSSStyleRule) {
            throw Error("The argument rule was not CSSStyleRule.");
        }

        if (rule.type !== CSSRule.STYLE_RULE) {
            throw Error("The CSSRule type was not STYLE_RULE.");
        }

        rules.push(rule);
        this._rules = rules;

        return this;
    };

    PrimitiveLink.prototype.toStyleOf = function (styleName) {

        const rules = this._assertRulesAreSelected();
        const rns = this._toStyleOfRuleAndStyleNames;
        const newRns = [];

        for (let i = 0; i < rules.length; ++i) {
            const rule = rules[i];
            let found = false;
            for (let j = 0; j < rns.length; ++j) {
                const rn = rns[j];
                if (rn.rule === rule && rn.styleName === styleName) {
                    found = true;
                    continue;
                }
            }
            if (!found) {
                newRns.push({
                    rule: rule,
                    styleName: styleName
                });
            }
        }

        Array.prototype.push.apply(rns, newRns);

        for (let i = 0; i < rns.length; ++i) {
            const rn = rns[i];
            rn.rule.style[rn.styleName] = this._value;
        }

        return this._objectLink;
    }

    PrimitiveLink.prototype._assertRulesAreSelected = function () {

        const rules = this._rules;

        if (isNullOrUndefined(rules)) {
            throw Error("No CSSStyleRules were selected.");
        }

        return rules;
    };

    /**
     * It propergates value to among the inputs and related object property.
     */
    PrimitiveLink.prototype._propagate = function (source, value) {

        const previousValue = this._previousValue;

        if (source !== this) {

            if (isNullOrUndefined(this._value)) {
                this._previousValue = "";
            } else {
                this._previousValue = "" + this._value;
            }

            this._value = value;
        }

        for (let eventType in this._listenerContexts) {
            const context = this._listenerContexts[eventType];
            const inputs = context.inputs;
            for (let i = 0; i < inputs.length; ++i) {
                const input = inputs[i];
                if (input === source) {
                    continue;
                }
                input.value = value;
            }
        }

        for (let i = 0; i < this._toTextElements.length; ++i) {
            const element = this._toTextElements[i];
            if (element === source) {
                continue;
            }
            element.textContent = value;
        }

        for (let attrName in this._toAttrContexts) {
            const context = this._toAttrContexts[attrName];
            const elements = context.elements;
            for (let i = 0; i < elements.length; ++i) {
                const element = elements[i];
                if (element === source) {
                    continue;
                }
                element.setAttribute(attrName, value);
            }
        }

        for (let i = 0; i < this._toClassElements.length; ++i) {
            const element = this._toClassElements[i];
            if (element === source) {
                continue;
            }
            const classList = element.classList;
            if (!isEmptyString(previousValue)) {
                classList.remove(previousValue);
            }
            if (!isEmptyString(value)) {
                classList.add(value);
            }
        }

        for (let key in this._turnClassContexts) {
            const context = this._turnClassContexts[key];
            const elements = context.elements;
            for (let i = 0; i < elements.length; ++i) {
                const element = elements[i];
                if (element === source) {
                    continue;
                }
                const on = context.onOrOff ? value : !value;
                if (on) {
                    element.classList.add(context.className);
                } else {
                    element.classList.remove(context.className);
                }
            }
        }

        const rns = this._toStyleOfRuleAndStyleNames;
        for (let i = 0; i < rns.length; ++i) {
            const rn = rns[i];
            rn.rule.style[rn.styleName] = this._value;
        }

    } // End of _propagate

    PrimitiveLink.prototype._destroy = function () {

        const eventTypes = Object.keys(this._listenerContexts);
        for (let i = 0; i < eventTypes.length; ++i) {
            const eventType = eventTypes[i];
            const context = this._listenerContexts[eventType];
            const inputs = context.inputs;
            for (let j = 0; j < inputs.length; ++j) {
                const input = inputs[j];
                input.removeEventListener(eventType, context.listener);
            }
        }

        return this;
    };

    return distlink;
});

