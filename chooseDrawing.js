import {SVGPreview} from './svgPreview.js';
import {CurveEditor} from './curveEditor.js';

// TODO add the option in drawcurve to change between lines and catmull and an option to generate a new polygon with n sides

export function ChooseDrawing(onChange, opt) {
    opt = opt || {};
    this.form = document.querySelector('#chooseDrawingForm');
    this.divDraw = document.querySelector('#shapeDraw');
    this.divSvg = document.querySelector('#shapeSvg');
    this.svgFileInput = document.querySelector('input[name="svgFile"]');
    this.linesCheckbox = document.querySelector('input[name="lines"]');
    const size = opt.size || 400;

    this.active = 'draw';

    this.form.onchange = (event) => {
        if (event.target.name === 'source') {
            this.active = event.target.value;
        }
    };

    this.onChange = onChange || (() => {});

    this.drawEditor = new CurveEditor(this.divDraw, {width: size, height: size, yRange: [0, size], closed: true, lines: this.linesCheckbox.checked});

    this.drawEditor.onChange = () => {
        this.onChange(this.getCurve());
    };
    this.linesCheckbox.onchange = (event) => {
        this.drawEditor.setLines(event.target.checked);
    };

    this.getCurve = () => {
        if (this.active === 'draw') return this.drawEditor.getCurve();
        throw Error(`Unhandled drawing mode ${this.active}`);
    }

    this.render = () => {
        this.drawEditor.render();
    };
}
