import {SVGPreview} from './svgPreview.js';
import {CurveEditor} from './curveEditor.js';
import {samplesvg} from './samplesvg.js';

// TODO add the option in drawcurve to change between lines and catmull and an option to generate a new polygon with n sides

function showOne(elements, idx) {
    console.log(idx);
    for (var i = 0; i < elements.length; i++) {
        elements[i].style.display = i === idx ? 'unset' : 'none';
    }
}

export function ChooseDrawing(onChange, opt) {
    opt = opt || {};
    this.form = document.querySelector('#chooseDrawingForm');
    this.divDraw = document.querySelector('#shapeDraw');
    this.divSvg = document.querySelector('#shapeSvg');
    this.svgFileInput = document.querySelector('input[name="svgFile"]');
    this.linesCheckbox = document.querySelector('input[name="lines"]');

    const size = opt.size || 400;

    this.active = 'svg';

    this.setActive = (kind) => {
        this.active = kind;

        showOne([this.divDraw, this.divSvg], +(kind === 'draw'));

        if (kind === 'svg') {
            if (this.svgFileInput.files.length === 0) {
                console.log('Loading sample SVG');
                this.svgPreview.load(URL.createObjectURL(new Blob([samplesvg])));
            } else {
                this.svgPreview.load(URL.createObjectURL(this.svgFileInput.files[0]));
            }
        }
    };

    this.form.onchange = (event) => {
        if (event.target.name === 'source') {
            this.setActive(event.target.value);
        }
    };

    this.onChange = onChange || (() => {});

    this.drawEditor = new CurveEditor(this.divDraw, {width: size, height: size, yRange: [0, size], closed: true, lines: this.linesCheckbox.checked});
    this.svgPreview = new SVGPreview(this.divSvg);

    this.drawEditor.onChange = () => {
        this.onChange(this.getCurve());
    };

    this.svgPreview.onChange = () => {
        this.onChange(this.getCurve());
    };

    this.linesCheckbox.onchange = (event) => {
        this.drawEditor.setLines(event.target.checked);
    };

    this.getCurve = () => {
        if (this.active === 'draw') return this.drawEditor.getCurve();
        if (this.active === 'svg') return this.svgPreview.getCurve();
        throw Error(`Unhandled drawing mode ${this.active}`);
    }

    this.render = () => {
        this.drawEditor.render();
        this.svgPreview.render();
    };

    this.setActive('svg');
}
