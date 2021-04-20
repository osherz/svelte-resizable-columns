import './flexibleColumns.css';

const DATA_API = 'flexibleColumns';
const DATA_COLUMNS_ID = 'flexible-columns-id';
const DATA_COLUMN_ID = 'flexible-column-id';
const DATA_TH = 'th';

const CLASS_TABLE_RESIZING = 'fc-table-resizing';
const CLASS_COLUMN_RESIZING = 'fc-column-resizing';
const CLASS_HANDLE = 'fc-handle';
const CLASS_HANDLE_NORESIZE = 'fc-handle-noresize';
const CLASS_HANDLE_CONTAINER = 'fc-handle-container';

const EVENT_RESIZE_START = 'column:resize:start';
const EVENT_RESIZE = 'column:resize';
const EVENT_RESIZE_STOP = 'column:resize:stop';

const SELECTOR_UNRESIZABLE = `[data-noresize]`;

function setWidthPx(element, width) {
    width = width.toFixed(2);
    width = width > 0 ? width : 0;
    element.style.width = width + 'px';
}

function setHeightPx(element, height) {
    height = height.toFixed(2);
    height = height > 0 ? height : 0;
    element.style.height = height + 'px';
}

function setLeftPx(element, left) {
    left = left.toFixed(2);
    left = left > 0 ? left : 0;
    element.style.left = left + 'px';
}

function getPointerX(event) {
    if (event.type.indexOf('touch') === 0) {
    return (event.originalEvent.touches[0] || event.originalEvent.changedTouches[0]).pageX;
    }
    return event.pageX;
}

function parseWidth(element) {
    return element ? parseFloat(element.style.width.replace('%', '')) : 0;
}

function getActualWidth(element) {
    return element ? parseFloat(element.offsetWidth) : 0;
}

function indexOfElementInParent(el) {
    if(el && el.parentNode && el.parentNode.children) {
        const children = el.parentNode.children,
        numItems = children.length;
        for (let index = 0; index < children.length; index++) {
            const element = children[index];
            if(element === el) {
                return index;
            }
        }
    }
    return -1;
}

function isVisible(el) {
    return el && el.style &&
        el.style.display !== 'none' &&
        el.style.visible !== 'hidden' &&
        (!el.type || el.type !== 'hidden');
}

function FlexibleColumns(table, options) {  
    if(!table || !table.tagName || table.tagName !== 'TABLE') {
      console.error('The FlexibleColumns action applies only to table DOM elements.');
    }

    table.FlexibleColumns = this;
    this.options = Object.assign({}, FlexibleColumns.defaults, options);
    this.window = window;
    this.ownerDocument = table.ownerDocument;
    this.table = table;
    this.handleContainer;
    this.tableHeaders;
    
    this.syncHandleWidthsCallback = this.syncHandleWidths.bind(this);
    this.onPointerMoveCallback = this.onPointerMove.bind(this);
    this.onPointerUpCallback = this.onPointerUp.bind(this);
    this.onPointerDownCallback = this.onPointerDown.bind(this);
    this.onPointerMoveCallback = this.onPointerMove.bind(this);
    
    this.setTableMinWidth();
    this.refreshHeaders();
    this.restoreColumnWidths();
    this.syncHandleWidths();
    
    this.window.addEventListener('resize', this.syncHandleWidthsCallback);

    //TODO: find better solution; when table columns adjust after a delay,
    setTimeout(() => this.syncHandleWidths(), 2000);
  
  return {
    update({syncHandlers}) {
        this.syncHandleWidths();
    },
    destroy() {

        let self = table.FlexibleColumns;
        table.FlexibleColumns = null;

        let handles = self.handleContainer.querySelectorAll('.'+CLASS_HANDLE);

        self.window.removeEventListener('resize', self.syncHandleWidthsCallback);        
        handles.forEach(el => {
            el.removeEventListener('mousedown', self.onPointerDownCallback);
            el.removeEventListener('touchstart', self.onPointerDownCallback);
        });

        self.operation = null;
        self.handleContainer.parentNode.removeChild(self.handleContainer);
        self.handleContainer = null;
        self.tableHeaders = null;
        self.table = null;
        self.ownerDocument = null;
        self.window = null;
        self.options = null;
    }
  };  
}

FlexibleColumns.prototype = {
    setTableMinWidth: function() {
        let width = this.options.minWidthTable,
            table = this.table;

        if(this.options.minWidthTable && this.options.minWidthTable === 'parent') {
            width = table.parentNode.offsetWidth;
        } else {            
            if (!this.options.minWidthTable) {
                width = table.offsetWidth;
            }
        }
        //is minWidth above maxWidth? Use maxWidth
        if(this.options.maxWidthTable && this.options.maxWidthTable > 0) {
            width = Math.min(this.options.maxWidthTable, width);
        }
        //is table currently below minWidth? Use actual width
        width = Math.min(table.offsetWidth, width);
        this.options.minWidthTable = width;
    },
    createHandles: function() {
        let ref = this.handleContainer;
        if (ref != null) {
            ref.parentNode.removeChild(ref);
        }

        this.handleContainer = document.createElement('div');
        this.handleContainer.className = CLASS_HANDLE_CONTAINER;
        this.table.parentNode.insertBefore(this.handleContainer, this.table);

        for (let i = 0; i < (this.tableHeaders.length); i++) {
            const el = this.tableHeaders[i];
            
            let current = this.tableHeaders[i];
            // let next = this.tableHeaders[i + 1];


            let handle = document.createElement('div');            
            if (current.matches(SELECTOR_UNRESIZABLE)) {
                handle.className = CLASS_HANDLE_NORESIZE;
            } else {
                handle.className = CLASS_HANDLE;
            }
            this.handleContainer.appendChild(handle);
        };

        
        let handles = this.handleContainer.querySelectorAll('.'+CLASS_HANDLE);
        handles.forEach(el => {
            el.addEventListener('mousedown', this.onPointerDownCallback);
            el.addEventListener('touchstart', this.onPointerDownCallback);
        });
    },
    refreshHeaders: function() {
        // Allow the selector to be both a regular selctor string as well as
        // a dynamic callback
        let getHeaders = this.options.getHeaders;
        if(typeof getHeaders !== 'function') {
            console.error('FlexibleColumns: options.getHeaders requires a function that returns the list of headers');
            return;
        }
        this.tableHeaders = Array.from(getHeaders.call(null, this.table)).filter(el => isVisible(el));

        this.createHandles();
    },
    restoreColumnWidths: function() {
        this.tableHeaders.forEach((el, _) => {

        if(this.options.store && !el.matches(SELECTOR_UNRESIZABLE)) {
            let width = this.options.store.get(
                this.generateColumnId(el)
            );

            if(width != null) {
                setWidthPx(el, width);
            }
        }
        });
    },
    generateColumnId: function($el) {
        return this.table.data(DATA_COLUMNS_ID) + '-' + $el.data(DATA_COLUMN_ID);
    },
    constrainWidth: function(width) {
        if (this.options.minWidth != undefined) {
            width = Math.max(this.options.minWidth, width);
        }

        if (this.options.maxWidth != undefined) {
            width = Math.min(this.options.maxWidth, width);
        }

        return width;
    },
    constrainTableWidth: function(width) {
        if (this.options.minWidthTable) {
            width = Math.max(this.options.minWidthTable, width);
        }

        if (this.options.maxWidthTable) {
            width = Math.min(this.options.maxWidthTable, width);
        }

        return width;
    },
    validateNewWidths: function(colWidth, tableWidth) {
        return colWidth === this.constrainWidth(colWidth) &&
            tableWidth === this.constrainTableWidth(tableWidth);
    },
    saveColumnWidths: function() {
        this.tableHeaders.forEach((el, _) => {

        if (this.options.store && !el.matches(SELECTOR_UNRESIZABLE)) {
            this.options.store.set(
                this.generateColumnId(el),
                parseWidth(el)
            );
        }
        });
    },    
    syncHandleWidths: function() {
        let container = this.handleContainer;

        setWidthPx(container, this.table.offsetWidth);

        let height = this.options.resizeFromBody ?
            this.table.offsetHeight :
            this.table.querySelector('thead').offsetHeight;

        container
        .querySelectorAll('div')
        // .querySelectorAll('.'+CLASS_HANDLE)
        .forEach((el, i) => {

            let header = this.tableHeaders[i];

            let left = header.clientWidth + (
                header.offsetLeft - this.handleContainer.offsetLeft
            ) + parseInt(getComputedStyle(this.handleContainer.parentNode).paddingLeft);

            setHeightPx(el, height);
            setLeftPx(el, left);
        });
    },
    onPointerDown: function(event) {
        // Only applies to left-click dragging
        if(event.which !== 1) { return; }

        // If a previous operation is defined, we missed the last mouseup.
        // Probably gobbled up by user mousing out the window then releasing.
        // We'll simulate a pointerup here prior to it
        if(this.operation) {
            this.onPointerUp(event);
        }

        // Ignore non-flexible columns
        let currentGrip = event.currentTarget;
        if(currentGrip.matches(SELECTOR_UNRESIZABLE)) {
            return;
        }

        let gripIndex = indexOfElementInParent(currentGrip);
        let leftColumn = this.tableHeaders[gripIndex];
        if(leftColumn && leftColumn.matches(SELECTOR_UNRESIZABLE)) {
            leftColumn = null;
        }

        let leftWidth = getActualWidth(leftColumn);
        let tableWidth = getActualWidth(this.table);

        this.operation = {
            leftColumn, currentGrip,
            table: this.table,

            startX: getPointerX(event),

            widths: {
                left: leftWidth,
                table: tableWidth
            },
            newWidths: {
                left: leftWidth,
                // right: rightWidth
                table: tableWidth
            }
        };

        this.ownerDocument.addEventListener('mousemove', this.onPointerMoveCallback);
        this.ownerDocument.addEventListener('touchmove', this.onPointerMoveCallback);
        this.ownerDocument.addEventListener('mouseup', this.onPointerUpCallback);
        this.ownerDocument.addEventListener('touchend', this.onPointerUpCallback);

        this.handleContainer.className += ` ${CLASS_TABLE_RESIZING}`;
        this.table.className += ` ${CLASS_TABLE_RESIZING}`;

        if(leftColumn) leftColumn.className += ` ${CLASS_COLUMN_RESIZING}`;
        currentGrip.className += ` ${CLASS_COLUMN_RESIZING}`;
        
        this.table.dispatchEvent(
            new CustomEvent('flexible-columns-start', {
            detail: { 
                leftColumn,
                leftWidth,
                tableWidth
             },
            })
        );

        event.preventDefault();
    },
    onPointerMove: function(event) {
        let op = this.operation;
        if(!this.operation) { return; }

        // Determine the delta change between start and new mouse position
        let difference = (getPointerX(event) - op.startX);
        if(difference === 0) {
            return;
        }

        let leftColumn = op.leftColumn;
        let table = this.table;
        let widthLeft, widthTable;

        if(difference !== 0) {
            widthLeft = op.widths.left + difference;
            widthTable = op.widths.table + difference;
        }

        if(!this.validateNewWidths(widthLeft, widthTable)) {
            return;
        }

        if(leftColumn) {
            setWidthPx(leftColumn, widthLeft);
        }

        if(table) {
            setWidthPx(table, widthTable);
        }

        op.newWidths.left = widthLeft;
        op.newWidths.table = widthTable;

        
        this.table.dispatchEvent(
            new CustomEvent('flexible-columns-move', {
            detail: { 
                leftColumn: op.leftColumn,
                leftWidth: widthLeft,
                tableWidth: widthTable
             },
            })
        );
    },
    onPointerUp: function(event) {
        let op = this.operation;
        if(!this.operation) { return; }

        this.ownerDocument.removeEventListener('mousemove', this.onPointerMoveCallback);
        this.ownerDocument.removeEventListener('touchmove', this.onPointerMoveCallback);
        this.ownerDocument.removeEventListener('mouseup', this.onPointerUpCallback);
        this.ownerDocument.removeEventListener('touchend', this.onPointerUpCallback);

        this.handleContainer.className = this.handleContainer.className.replace(' '+CLASS_TABLE_RESIZING, '');
        this.table.className = this.table.className.replace(' '+CLASS_TABLE_RESIZING, '');

        if(op.leftColumn) op.leftColumn.className = op.leftColumn.className.replace(' '+CLASS_COLUMN_RESIZING, '');
        op.currentGrip.className = op.currentGrip.className.replace(' '+CLASS_COLUMN_RESIZING, '');

        this.syncHandleWidths();
        this.saveColumnWidths();

        this.operation = null;

        
        this.table.dispatchEvent(
            new CustomEvent('flexible-columns-stop', {
            detail: { 
                leftColumn: op.leftColumn,
                // rightColumn: op.rightColumn,
                leftWidth: op.newWidths.left,
                tableWidth: op.newWidths.table
             },
            })
        );
    }
}

FlexibleColumns.constructor = FlexibleColumns;

FlexibleColumns.defaults = {
  getHeaders: function(table) {
    const thead = table.querySelector('thead');
    
    if(thead) {
        return thead.querySelectorAll('th');
    } else {
        const tr = table.querySelector('tr');
        return tr.querySelectorAll('td');
    }
  },
  store: window.store,
  syncHandlers: true,
  resizeFromBody: true,
  maxWidth: null,
  minWidth: 0.01,
  maxWidthTable: null,
  minWidthTable: 'parent'  
};

FlexibleColumns.count = 0;

export default function(node, options) {
    return new FlexibleColumns(node, options);
}