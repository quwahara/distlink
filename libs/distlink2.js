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
        return new ObjectLink(null, object);
    }

    const ObjectLink = /** @lends ObjectLink */ function ObjectLink(parentObjectLink, object) {

        this._selected = null;
        this._props = {};

        if (parentObjectLink == null) {
            // It's OK.
        }
        else if (parentObjectLink.constructor !== this) {
            // TODO
        }

        if (!isObject(object)) {
            // TODO
        }

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

    ObjectLink.prototype.constructor = ObjectLink;

    const Prop = /** @lends Prop */ function Prop(objectLink, link, key) {

        this._link = link;

        (function (link) {
            Object.defineProperty(objectLink, key, {
                enumerable: true,
                get: function () {
                    return link;
                },
            });
        })(link);
    }

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
        this._items.push(new Item(this, createLink(this, value)));
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

    ArrayLink.prototype._propagate = function (source, value) {

        if (source !== this && this._value !== value) {
            this._value = value;
        }

        for (let i = 0; i < this._items.length; ++i) {
            const item = this._items[i];
            item._propagate();
        }
    };

    const Item = /** @lends Item */ function Item(arrayLink, link) {
        this._arrayLink = arrayLink;
        this._link = link;
    }

    Item.prototype._propagate = function (source, value) {

    };

    const EachPropagation = /** @lends EachPropagation */ function EachPropagation(arrayLink, element, callback) {
        this._arrayLink = arrayLink;
        this._element = element;
        this._callback = callback;
        this._firstElementChild = element.firstElementChild ? element.firstElementChild.cloneNode(true) : null;
        removeChildren(this._element);
        this._childElements = [];
    }

    EachPropagation.prototype.propagate = function () {

        const items = this._arrayLink._items;
        const callback = this._callback;
        const arrayLink = this._arrayLink;
        for (let index = 0; index < items.length; index++) {

            // Create and fill child element array if length of child element array is less than index
            const childElements = this._childElements;
            const firstElementChild = this._firstElementChild;
            const element = this._element;
            while (childElements.length <= index) {
                let childElement = null;
                if (childElements.length === index) {
                    if (firstElementChild) {
                        childElement = firstElementChild.cloneNode(true);
                        element.appendChild(childElement);
                    }
                }
                childElements.push(childElement);
            }

            let childElement = childElements[index];

            const link = items[index]._link;
            if (childElement) {
                link.select(childElement);
            }

            callback.call(arrayLink, link, childElement, index, element);
        }
    }

    const PrimLink = /** @lends PrimLink */ function PrimLink(parentLink, value) {
        this._parentLink = parentLink;
        this._previousValue = undefined;
        this._value = value;
        this._propagations = [];
    }

    PrimLink.prototype._setValue = function (value) {
        if (this._value !== value) {
            this._previousValue = this._value;
            this._value = value;
            this._propagate();
        }
    }

    PrimLink.prototype._assertSelected = function () {

        const selected = this._selected;

        if (!isElementNode(selected)) {
            throw Error("No ElementNode was selected.");
        }

        return selected;
    };

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

    PrimLink.prototype.toText = function () {
        const element = this._assertSelected();
        const propagation = new ToTextPropagation(this, element);
        propagation.propagate();
        this._propagations.push(propagation);
        return this._parentLink;
    }

    PrimLink.prototype._propagate = function () {
        for (let i = 0; i < this._propagations.length; i++) {
            this._propagations[i].propagate();
        }
    }

    const ToTextPropagation = /** @lends ToTextPropagation */ function ToTextPropagation(primLink, element) {
        this._primLink = primLink;
        this._element = element;
    }

    ToTextPropagation.prototype.propagate = function () {
        this._element.textContent = this._primLink._value;
    }

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

    return distlink;
});

