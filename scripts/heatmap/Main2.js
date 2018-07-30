requirejs(['./worldwind.min',
        './LayerManager',
        './RadiantCircleTile',
        '../../config/mainconf'],
    function (WorldWind,
              LayerManager,
              RadiantCircleTile) {
        "use strict";

        var table = $("#dataDisplay").DataTable();
        table.columns([0, 1]).visible(false);
        table.order(2, 'asc');
        var latilong;
        var idFilter;

        // reading configGlobal from mainconf.js
        var mainconfig = config;

        // Tell WorldWind to log only warnings and errors.
        WorldWind.Logger.setLoggingLevel(WorldWind.Logger.LEVEL_WARNING);

        // Create the WorldWindow.
        var wwd = new WorldWind.WorldWindow("canvasOne");

        // Create and add layers to the WorldWindow.
        var layers = [
            // Imagery layers.
            {layer: new WorldWind.BMNGLayer(), enabled: true},
            {layer: new WorldWind.BMNGLandsatLayer(), enabled: true},
            // {layer: new WorldWind.BingAerialLayer(null), enabled: false},
            {layer: new WorldWind.BingAerialWithLabelsLayer(null), enabled: true},
            // {layer: new WorldWind.BingRoadsLayer(null), enabled: false},
            // {layer: new WorldWind.OpenStreetMapImageLayer(null), enabled: false},
            // Add atmosphere layer on top of all base layers.
            {layer: new WorldWind.AtmosphereLayer(), enabled: true},
            // WorldWindow UI layers.
            {layer: new WorldWind.CompassLayer(), enabled: true},
            {layer: new WorldWind.CoordinatesDisplayLayer(wwd), enabled: true},
            {layer: new WorldWind.ViewControlsLayer(wwd), enabled: true}
        ];

        for (var l = 0; l < layers.length; l++) {
            layers[l].layer.enabled = layers[l].enabled;
            wwd.addLayer(layers[l].layer);
        }

        // Create a layer manager for controlling layer visibility.
        var layerManager = new LayerManager(wwd);

        // Now set up to handle highlighting.
        var highlightController = new WorldWind.HighlightController(wwd);

        $('#dataDisplay tbody').on('click', 'tr', function () {
            $(this).toggleClass('selected');    //toggle class for the rows selected

            var data = table.rows('.selected').data();
            // var placemark = wwd.layers[11].renderables;
            var layers = wwd.layers;
            var originalSize = true;

            for (var i = 7; i < layers.length - 1; i++) {

                if (data.length === 0 && layers[i].renderables[0].attributes.imageScale === 1.0) {
                    changeScale(layers[i].renderables[0], 0.5, 0.6);
                    break;
                }

                for (var z = 0; z < data.length; z++) {
                    if (layers[i].renderables[0].userProperties === data[z][2]) {
                        if (layers[i].renderables[0].attributes.imageScale === 0.5) {
                            // console.log(layers[i].renderables[0].userProperties + " A");
                            changeScale(layers[i].renderables[0], 1.0, 1.2);
                            wwd.goTo(new WorldWind.Position(layers[i].renderables[0].position.latitude, layers[i].renderables[0].position.longitude, 10000000));

                            if (!$("#switchLayer").is(':checked')) {
                                $("#switchLayer").click();
                            }
                        }
                        originalSize = false;
                        break;
                    } else {
                        if (z === data.length - 1) {
                            if (originalSize && layers[i].renderables[0].attributes.imageScale === 1.0) {
                                // console.log(layers[i].renderables[0].userProperties + " C");
                                changeScale(layers[i].renderables[0], 0.5, 0.6);
                            }

                            originalSize = true;
                        }
                    }
                }
            }

            function changeScale(placemark, imageScale, highlightScale) {

                placemark.attributes.imageScale = imageScale;
                placemark.highlightAttributes.imageScale = highlightScale;

                // var info = placemark[i];
                //
                // placemark.splice(i, 1);
                //
                // var canvas = document.createElement("canvas"),
                //     ctx2d = canvas.getContext("2d"),
                //     size = 64, c = size / 2  - 0.5, innerRadius = 5, outerRadius = 20;
                //
                // canvas.width = size;
                // canvas.height = size;
                //
                // var gradient = ctx2d.createRadialGradient(c, c, innerRadius, c, c, outerRadius);
                // gradient.addColorStop(0, 'rgb(204, 255, 255)');
                // gradient.addColorStop(0.5, 'rgb(102, 153, 255)');
                // gradient.addColorStop(1, 'rgb(102, 0, 255)');
                //
                // ctx2d.fillStyle = gradient;
                // ctx2d.arc(c, c, outerRadius, 0, 2 * Math.PI, false);
                // ctx2d.fill();
                //
                // var placemarkAttributess = new WorldWind.PlacemarkAttributes(null);
                // placemarkAttributess.imageSource = new WorldWind.ImageSource(canvas);
                // placemarkAttributess.imageScale = imageScale;
                //
                // var highlightAttributess = new WorldWind.PlacemarkAttributes(placemarkAttributess);
                // highlightAttributess.imageScale = highlightScale;
                //
                // var placemarkPositions = new WorldWind.Position(info.position.latitude, info.position.longitude, 0);
                // var placemarks = new WorldWind.Placemark(placemarkPositions, false, placemarkAttributess);
                // placemarks.userProperties = info.userProperties;
                // placemarks.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                // placemarks.highlightAttributes = highlightAttributess;
                // wwd.layers[11].addRenderable(placemarks);
                //
                // placemark.splice(i, 0, placemark[placemark.length - 1]);
                // placemark.splice(placemark.length - 1, 1);
            }

        });

        $("#switchLayer").on("click", function () {
            // this.checked, true: placemark, false: heatmap
            // 7 basis layers
            // console.log(this.checked + "   " + !this.checked);

            for (var i = 7; i < wwd.layers.length; i++) {
                if (i === wwd.layers.length - 1) {
                    wwd.layers[i].enabled = !this.checked;
                    // console.log(wwd.layers);
                } else {
                    // wwd.layers[i].enabled = this.checked;
                    hidePlacemark(wwd.layers[i], this.checked);
                }
            }

            function hidePlacemark(layer, status) {
                var circle = document.createElement("canvas"),
                    ctx = circle.getContext('2d'),
                    radius = 15,
                    r2 = radius + radius;

                circle.width = circle.height = r2;

                var gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);

                if (status) {
                    console.log("A");
                    gradient.addColorStop(0, 'rgb(204, 255, 255)');
                    gradient.addColorStop(0.5, 'rgb(102, 153, 255)');
                    gradient.addColorStop(1, 'rgb(102, 0, 255)');
                } else {
                    console.log("B");
                    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
                }

                ctx.beginPath();
                ctx.arc(radius, radius, radius, 0, Math.PI * 2, true);

                ctx.fillStyle = gradient;
                ctx.fill();

                ctx.closePath();

                layer.renderables[0].updateImage = true;
                layer.renderables[0].attributes.imageSource.image = circle;
            }
        });

        // $("#testButton").on('click', function() {
        //     console.log(wwd.layers);
        //     $("#buttons").append(wwd.layers[7].renderables[0].attributes.imageSource.image);
        // });

        wwd.worldWindowController.__proto__.handleWheelEvent = function (event) {
            var navigator = this.wwd.navigator;
            // Normalize the wheel delta based on the wheel delta mode. This produces a roughly consistent delta across
            // browsers and input devices.
            var normalizedDelta;
            if (event.deltaMode === WheelEvent.DOM_DELTA_PIXEL) {
                normalizedDelta = event.deltaY;
            } else if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
                normalizedDelta = event.deltaY * 40;
            } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
                normalizedDelta = event.deltaY * 400;
            }

            // Compute a zoom scale factor by adding a fraction of the normalized delta to 1. When multiplied by the
            // navigator's range, this has the effect of zooming out or zooming in depending on whether the delta is
            // positive or negative, respectfully.
            var scale = 1 + (normalizedDelta / 1000);

            // Apply the scale to this navigator's properties.
            navigator.range *= scale;
            this.applyLimits();
            this.wwd.redraw();

            refreshTable();
            //autoSwitch();
        };

        /*function autoSwitch() {
            var altitude = wwd.layers[5].eyeText.text.replace(/Eye  |,| km/g, '');

            if (altitude <= mainconfig.eyeDistance_switch && $("#switchLayer").is(':checked')) {
                $("#switchLayer").click();
                $("#switchNote").html("");
                $("#switchNote").append("NOTE: Toggled switch to temporarily view placemarks.");
                $("#globeNote").html("");
                $("#globeNote").append("NOTE: Zoom in to an eye distance of more than 4,500 km to view placemarks.");
            } else if (altitude > mainconfig.eyeDistance_switch && !$("#switchLayer").is(':checked')) {
                $("#switchLayer").click();
                $("#switchNote").html("");
                $("#switchNote").append("NOTE: Toggled switch to temporarily view heatmap.");
                $("#globeNote").html("");
                $("#globeNote").append("NOTE: Zoom in to an eye distance of less than 4,500 km to view heatmap.");
                // table.search("").columns().search("").draw();
            }
        }*/

        function refreshTable() {
            var layerNames = "";
            for (var i = 7; i < wwd.layers.length - 1; i++) {
                if (wwd.layers[i].inCurrentFrame === true) {
                    layerNames += "" + wwd.layers[i].displayName + "|";
                }

                if (i === wwd.layers.length - 2) {
                    // console.log(layerNames.substring(0, layerNames.length - 1).split('|'));
                    // var test = "Layer|bluegrass|blugrass|Boma example|Building C|Dar es Salaam ";
                    // table.column(2).search("^" + test + "$", true, false, false).draw();
                    table.column(2).search("^" + layerNames.substring(0, layerNames.length - 1) + "$", true, false, false).draw();
                }
            }
        }

        function handleMouseMove(o) {

            if ($("#popover").is(":visible")) {
                $("#popover").hide();
            }

            // The input argument is either an Event or a TapRecognizer. Both have the same properties for determining
            // the mouse or tap location.
            var x = o.clientX,
                y = o.clientY;

            // Perform the pick. Must first convert from window coordinates to canvas coordinates, which are
            // relative to the upper left corner of the canvas rather than the upper left corner of the page.

            var pickList = wwd.pick(wwd.canvasCoordinates(x, y));
            for (var q = 0; q < pickList.objects.length; q++) {
                var pickedPL = pickList.objects[q].userObject;
                if (pickedPL instanceof WorldWind.Placemark) {

                    var xOffset = Math.max(document.documentElement.scrollLeft, document.body.scrollLeft);
                    var yOffset = Math.max(document.documentElement.scrollTop, document.body.scrollTop);

                    var popover = document.getElementById('popover');
                    popover.style.position = "absolute";
                    popover.style.left = (x + xOffset) + 'px';
                    popover.style.top = (y + yOffset) + 'px';

                    var indexes = table.rows().eq(0).filter( function (rowIdx) {
                        return table.cell(rowIdx, 2).data() === pickedPL.userProperties ? true : false;
                    });

                    var data = table.rows(indexes).data()[0];

                    var content = "<p><strong>Field Name :</strong> " + data[2] +
                        "<br>" + "<strong>Field Owner :</strong> " + data[1] +
                        "<br>" + "<strong>Date :</strong> " + data[3] +
                        "<br>" + "<strong>Crop Size :</strong> " + data[9] + " " + data[10] +
                        "<br>" + "<strong>Farming System :</strong> " + data[8] + "</p>";

                    $("#popover").attr('data-content', content);
                    $("#popover").show();

                    latilong = pickedPL.position;
                    idFilter = pickedPL.userProperties;
                }
            }
            pickList = [];
        }

        $("#popover").on("click", function () {
            autoZoom(latilong, idFilter);
        });

        function handleMouseCLK(o) {

            // The input argument is either an Event or a TapRecognizer. Both have the same properties for determining
            // the mouse or tap location.
            var x = o.clientX,
                y = o.clientY;

            // Perform the pick. Must first convert from window coordinates to canvas coordinates, which are
            // relative to the upper left corner of the canvas rather than the upper left corner of the page.

            var pickList = wwd.pick(wwd.canvasCoordinates(x, y));
            // console.log(pickList.objects.length);
            for (var q = 0; q < pickList.objects.length; q++) {
                var pickedPL = pickList.objects[q].userObject;
                if (pickedPL instanceof WorldWind.Placemark) {
                    // console.log("A");
                    autoZoom(pickedPL.position, pickedPL.userProperties);
                }
            }
            pickList = [];
        }

        function autoZoom(position, id) {
            wwd.goTo(new WorldWind.Position(position.latitude, position.longitude, 5000));

            table.columns(2).search("^" + id + "$", true, false, false).draw();

            $("#switchLayer").click()

            // var isChecked = $("#switchLayer").attr('checked');
            //
            // for (var i = 7; i < wwd.layers.length; i++) {
            //     if (i === wwd.layers.length - 1) {
            //         wwd.layers[i].enabled = isChecked;
            //     } else {
            //         wwd.layers[i].enabled = !isChecked;
            //     }
            //
            //     if (i === wwd.layers.length - 1) {
            //         table.columns(0).search(id).draw();
            //     }
            // }
        }

        $("#loadHeatmap").on("click", function () {
            wwd.layers.splice(7, wwd.layers.length - 7);
            table.clear().draw();

            var data = 'startDate=' + document.getElementById("startDate").value + '&endDate=' + document.getElementById("endDate").value;
            $.ajax({
                url: 'heatmapDataP',
                type: 'GET',
                dataType: 'json',
                data: data,
                async: false,
                success: function (resp) {

                    // var latitude = [];
                    // var longitude = [];
                    // var intensities = [];
                    // var min = Infinity;
                    // var max = -Infinity;
                    //
                    // // var health = [];
                    //
                    // // date, country, cropMain, cropIrrigation, cropStage, cropSystem, cropFieldSize, cropFieldSizeUnit, rainAmount, totalFAW
                    //
                    // // var table = $("#dataDisplay").DataTable();
                    //
                    // for (var i = 0; i < resp.message.length; i++) {
                    //     latitude[i] = resp.message[i].latitude;
                    //     longitude[i] = resp.message[i].longitude;
                    //     intensities[i] = resp.message[i].intensity;
                    //
                    //     max = Math.max(intensities[i], max);
                    //     min = Math.min(intensities[i], min);
                    //
                    //     table.row.add([
                    //         resp.message[i]._id,
                    //         // resp.message[i].latitude,
                    //         // resp.message[i].longitude,
                    //         resp.message[i].date,
                    //         resp.message[i].country,
                    //         resp.message[i].cropMain,
                    //         resp.message[i].cropIrrigation,
                    //         resp.message[i].cropStage,
                    //         resp.message[i].cropSystem,
                    //         resp.message[i].cropFieldSize,
                    //         resp.message[i].cropFieldSizeUnit,
                    //         resp.message[i].rainAmount,
                    //         resp.message[i].totalFAW
                    //     ]).draw(false);
                    //
                    //     if (i === resp.message.length - 1) {
                    //         table.columns([]).visible(false);
                    //         drawHeatMap();
                    //     }
                    // }
                    //
                    // function calculateIntensity() {
                    //     for (var i = 0; i < intensities.length; i++) {
                    //         intensities[i] = ((intensities[i] - min) / (max - min)) * 100;
                    //         if (i === intensities.length - 1) {
                    //             drawHeatMap();
                    //         }
                    //     }
                    // }
                    //
                    // function drawHeatMap() {
                    //     var data = [];
                    //     // var data2 = [];
                    //     for (var i = 0; i < intensities.length; i++) {
                    //         data[i] = new WorldWind.IntensityLocation(latitude[i], longitude[i], intensities[i]);
                    //         // data2[i] = new WorldWind.IntensityLocation(latitude[i], longitude[i], health[i]);
                    //         if (i === intensities.length - 1) {
                    //             console.log(data);
                    //
                    //             // var testData = [new WorldWind.IntensityLocation(-1, -1, 15), new WorldWind.IntensityLocation(1, -1, 15), new WorldWind.IntensityLocation(-1, 1, 15), new WorldWind.IntensityLocation(1, 1, 15)];
                    //             // var testData = [new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1)];
                    //
                    //             var HeatMapLayer = new WorldWind.HeatMapLayer("Custom Heatmap", data, {
                    //                 tile: RadiantCircleTile,
                    //                 incrementPerIntensity: 1/50,
                    //                 blur: 10,
                    //                 scale: ['#000000', '#ffffff', '#00ff00', '#ffff00', '#ff0000']
                    //             });
                    //
                    //             HeatMapLayer.enabled = false;
                    //             wwd.addLayer(HeatMapLayer);
                    //             layerManager.synchronizeLayerList();
                    //             console.log(wwd);
                    //             placemarkLayer();
                    //         }
                    //     }
                    //
                    // }
                    //
                    // function placemarkLayer() {
                    //     var canvas = document.createElement("canvas"),
                    //         ctx2d = canvas.getContext("2d"),
                    //         size = 64, c = size / 2  - 0.5, innerRadius = 5, outerRadius = 20;
                    //
                    //     canvas.width = size;
                    //     canvas.height = size;
                    //
                    //     var gradient = ctx2d.createRadialGradient(c, c, innerRadius, c, c,   outerRadius);
                    //     gradient.addColorStop(0, 'rgb(204, 255, 255)');
                    //     gradient.addColorStop(0.5, 'rgb(102, 153, 255)');
                    //     gradient.addColorStop(1, 'rgb(102, 0, 255)');
                    //
                    //     ctx2d.fillStyle = gradient;
                    //     ctx2d.arc(c, c, outerRadius, 0, 2 * Math.PI, false);
                    //     ctx2d.fill();
                    //
                    //     var placemarkLayer = new WorldWind.RenderableLayer("Custom Placemark");
                    //     // var pushpin = "../../pic/plain-white.png";
                    //
                    //     for (var i = 0; i < resp.message.length; i++) {
                    //         var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
                    //         placemarkAttributes.imageSource = new WorldWind.ImageSource(canvas);
                    //         placemarkAttributes.imageScale = 0.5;
                    //
                    //         var highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
                    //         highlightAttributes.imageScale = 0.6;
                    //
                    //         var placemarkPosition = new WorldWind.Position(resp.message[i].latitude, resp.message[i].longitude, 0);
                    //         var placemark = new WorldWind.Placemark(placemarkPosition, false, placemarkAttributes);
                    //         placemark.userProperties = resp.message[i]._id;
                    //         placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                    //         placemark.highlightAttributes = highlightAttributes;
                    //         placemarkLayer.addRenderable(placemark);
                    //
                    //         if (i === resp.message.length - 1) {
                    //             wwd.addLayer(placemarkLayer);
                    //             console.log(wwd.layers);
                    //             layerManager.synchronizeLayerList();
                    //         }
                    //     }
                    // }


                    function convert(dms) {
                        var parts = dms.replace(/°|'/g, '').split(' ');

                        var dd = parseFloat(parts[1]) + parseFloat(parts[2])/60 + parseFloat(parts[3])/3600;

                        if (parts[0] === "S" || parts[0] === "W") {
                            dd = dd * -1;
                        }

                        return dd;
                    }

                    if (!resp.error) {
                        var data = [];

                        var circle = document.createElement("canvas"),
                            ctx = circle.getContext('2d'),
                            radius = 15,
                            r2 = radius + radius;

                        circle.width = circle.height = r2;

                        var gradient = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
                        gradient.addColorStop(0, 'rgb(204, 255, 255)');
                        gradient.addColorStop(0.5, 'rgb(102, 153, 255)');
                        gradient.addColorStop(1, 'rgb(102, 0, 255)');
                        // gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');

                        ctx.beginPath();
                        ctx.arc(radius, radius, radius, 0, Math.PI * 2, true);

                        ctx.fillStyle = gradient;
                        ctx.fill();

                        ctx.closePath();

                        // console.log(wwd.layers);

                        for (var i = 0; i < resp.data.length; i++) {
                            resp.data[i].Latitude = convert(resp.data[i].Latitude);
                            resp.data[i].Longitude = convert(resp.data[i].Longitude);

                            data[i] = new WorldWind.IntensityLocation(resp.data[i].Latitude, resp.data[i].Longitude, resp.data[i].intensity);

                            table.row.add([
                                resp.data[i].transactionID,
                                resp.data[i].firstName + " " + resp.data[i].lastName,
                                resp.data[i].Location_name,
                                resp.data[i].Date,
                                resp.data[i].General_health,
                                resp.data[i].Main_crop,
                                resp.data[i].Irrigation,
                                resp.data[i].Crop_stage,
                                resp.data[i].Farming_system,
                                resp.data[i].Field_size,
                                resp.data[i].Field_size_unit,
                                resp.data[i].Rain_amount
                            ]).draw(false);

                            // table.row.add([
                            //     resp.data[i]._id,
                            //     // resp.message[i].latitude,
                            //     // resp.message[i].longitude,
                            //     resp.data[i].date,
                            //     resp.data[i].country,
                            //     resp.data[i].cropMain,
                            //     resp.data[i].cropIrrigation,
                            //     resp.data[i].cropStage,
                            //     resp.data[i].cropSystem,
                            //     resp.data[i].cropFieldSize,
                            //     resp.data[i].cropFieldSizeUnit,
                            //     resp.data[i].rainAmount,
                            //     resp.data[i].totalFAW
                            // ]).draw(false);

                            if (i === 0 || resp.data[i].Location_name !== resp.data[i - 1].Location_name) {
                                var placemarkLayer = new WorldWind.RenderableLayer(resp.data[i].Location_name);
                                // placemarkLayer.enabled = false;
                                wwd.addLayer(placemarkLayer);

                                var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
                                placemarkAttributes.imageSource = new WorldWind.ImageSource(circle);
                                placemarkAttributes.imageScale = 0.5;

                                var highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
                                highlightAttributes.imageScale = 1.0;

                                var placemarkPosition = new WorldWind.Position(resp.data[i].Latitude, resp.data[i].Longitude, 0);
                                var placemark = new WorldWind.Placemark(placemarkPosition, false, placemarkAttributes);
                                placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                                placemark.highlightAttributes = highlightAttributes;
                                // placemark.userProperties = resp.data[i].transactionID;
                                placemark.userProperties = resp.data[i].Location_name;

                                wwd.layers[wwd.layers.length - 1].addRenderable(placemark);
                            }

                            if (i === resp.data.length - 1) {

                                // console.log(data);
                                var HeatMapLayer = new WorldWind.HeatMapLayer("Heatmap", data, {
                                    tile: RadiantCircleTile,
                                    incrementPerIntensity: 1/50,
                                    blur: 10,
                                    scale: ['#000000', '#ffffff', '#00ff00', '#ffff00', '#ff0000']
                                });

                                HeatMapLayer.enabled = false;
                                wwd.addLayer(HeatMapLayer);

                                // wwd.goTo(new WorldWind.Position(0, 0, 10000000));
                                wwd.goTo(new WorldWind.Position(0, 0, mainconfig.eyeDistance_initial));
                                // console.log(wwd.layers);
                            }
                        }
                    }
                }
            });
        });

        $("#loadHeatmap").click();

        // Listen for mouse double clicks placemarks and then pop up a new dialog box.
        wwd.addEventListener("click", handleMouseCLK);

        $("#popover").popover({html: true, placement: "top", trigger: "hover"});

        // Listen for mouse moves and highlight the placemarks that the cursor rolls over.
        wwd.addEventListener("mousemove", handleMouseMove);
    });