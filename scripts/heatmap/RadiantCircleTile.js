define(['worldwind.min.js'], function (WorldWind) {
    "use strict";

    var ColoredTile = WorldWind.ColoredTile;

    var RadiantCircleTile = function() {
        ColoredTile.apply(this, arguments);
    };

    RadiantCircleTile.prototype = Object.create(ColoredTile.prototype);

    RadiantCircleTile.prototype.shape = function() {
        var circle = this.createCanvas(this._width, this._height),
            ctx = circle.getContext('2d'),
            r2 = this._radius + this._radius;

        circle.width = circle.height = r2;

        var gradient = ctx.createRadialGradient(this._radius, this._radius, 0, this._radius, this._radius, this._radius);
        gradient.addColorStop(0, "rgba(0,0,0,1)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");

        ctx.beginPath();
        ctx.arc(this._radius, this._radius, this._radius, 0, Math.PI * 2, true);

        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.closePath();

        return circle;

        // var circle = document.createElement("canvas");
        // var ctx = circle.getContext('2d');
        // circle.width = circle.height = 30;
        //
        // var gradient = ctx.createRadialGradient(15, 15, 0, 15, 15, 15);
        // gradient.addColorStop(0, "rgba(0,0,0,1)");
        // gradient.addColorStop(0.5, "rgba(0,0,0,0)");
        //
        // ctx.beginPath();
        // ctx.arc(15, 15, 15, 0, Math.PI * 2, true);
        //
        // ctx.fillStyle = gradient;
        // ctx.fill();
        //
        // ctx.closePath();
        //
        // return circle;
    };

    return RadiantCircleTile;

    // var circle = document.createElement("canvas");
    // var ctx = circle.getContext('2d');
    // circle.width = circle.height = 50;
    //
    // var gradient = ctx.createRadialGradient(25, 25, 0, 25, 25, 25);
    // gradient.addColorStop(0, "rgba(0,0,0,1)");
    // gradient.addColorStop(1, "rgba(0,0,0,0)");
    //
    // ctx.beginPath();
    // ctx.arc(25, 25, 25, 0, Math.PI * 2, true);
    //
    // ctx.fillStyle = gradient;
    // ctx.fill();
    //
    // ctx.closePath();
    //
    // return circle;
});