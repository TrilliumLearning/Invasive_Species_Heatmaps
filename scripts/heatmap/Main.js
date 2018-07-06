requirejs(['./worldwind.min',
        './LayerManager',
        './RadiantCircleTile'],
    function (WorldWind,
              LayerManager,
              RadiantCircleTile) {
        "use strict";

        var table = $("#dataDisplay").DataTable();

        $(function () {
            flatpickr(".date", {
                dateFormat: "Y-m-d",
                time_24hr: true
            });
        });

        // Tell WorldWind to log only warnings and errors.
        WorldWind.Logger.setLoggingLevel(WorldWind.Logger.LEVEL_WARNING);

        // Create the WorldWindow.
        var wwd = new WorldWind.WorldWindow("canvasOne");

        // Create and add layers to the WorldWindow.
        var layers = [
            // Imagery layers.
            {layer: new WorldWind.BMNGLayer(), enabled: true},
            {layer: new WorldWind.BMNGLandsatLayer(), enabled: false},
            {layer: new WorldWind.BingAerialLayer(null), enabled: false},
            {layer: new WorldWind.BingAerialWithLabelsLayer(null), enabled: true},
            {layer: new WorldWind.BingRoadsLayer(null), enabled: false},
            {layer: new WorldWind.OpenStreetMapImageLayer(null), enabled: false},
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
        });

        $("#loadHeatmap").on("click", function () {
            var data = {'startDate': document.getElementById("startDate").value, 'endDate': document.getElementById("endDate").value};
            $.ajax({
                url: 'http://localhost:9087/heatmapData',
                type: 'GET',
                dataType: 'json',
                data: data,
                async: false,
                success: function (resp) {
                    console.log(resp);

                    var latitude = [];
                    var longitude = [];
                    var intensities = [];
                    var min = Infinity;
                    var max = -Infinity;

                    var health = [];

                    // date, country, cropMain, cropIrrigation, cropStage, cropSystem, cropFieldSize, cropFieldSizeUnit, rainAmount, totalFAW

                    // var table = $("#dataDisplay").DataTable();

                    for (var i = 0; i < resp.message.length; i++) {
                        latitude[i] = resp.message[i].latitude;
                        longitude[i] = resp.message[i].longitude;
                        intensities[i] = resp.message[i].intensity;

                        max = Math.max(intensities[i], max);
                        min = Math.min(intensities[i], min);

                        table.row.add([
                            resp.message[i].date,
                            resp.message[i].country,
                            resp.message[i].cropMain,
                            resp.message[i].cropIrrigation,
                            resp.message[i].cropStage,
                            resp.message[i].cropSystem,
                            resp.message[i].cropFieldSize,
                            resp.message[i].cropFieldSizeUnit,
                            resp.message[i].rainAmount,
                            resp.message[i].totalFAW
                        ]).draw(false);

                        if (i === resp.message.length - 1) {
                            calculateIntensity();
                        }
                    }

                    function calculateIntensity() {
                        for (var i = 0; i < intensities.length; i++) {
                            intensities[i] = ((intensities[i] - min) / (max - min)) * 100;
                            if (i === intensities.length - 1) {
                                drawHeatMap();
                            }
                        }
                    }

                    function drawHeatMap() {
                        var data = [];
                        var data2 = [];
                        for (var i = 0; i < intensities.length; i++) {
                            data[i] = new WorldWind.IntensityLocation(latitude[i], longitude[i], intensities[i]);
                            data2[i] = new WorldWind.IntensityLocation(latitude[i], longitude[i], health[i]);
                            if (i === intensities.length - 1) {
                                // console.log(data);

                                var testData = [new WorldWind.IntensityLocation(-1, -1, 15), new WorldWind.IntensityLocation(1, -1, 15), new WorldWind.IntensityLocation(-1, 1, 15), new WorldWind.IntensityLocation(1, 1, 15)];
                                // var testData = [new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1)];


                                var HeatMapLayer = new WorldWind.HeatMapLayer("Custom Heatmap", data, {
                                    tile: RadiantCircleTile,
                                    incrementPerIntensity: 0.01,
                                    blur: 10,
                                    scale: ['#ffffff', '#00ff00', '#ffff00', '#ff0000']
                                });

                                HeatMapLayer.enabled = false;
                                wwd.addLayer(HeatMapLayer);
                                // console.log(wwd.layers);

                                // console.log(data2);
                                // var HeatMapLayer2 = new WorldWind.HeatMapLayer("Custom Heatmap", data2, {
                                //     tile: RadiantCircleTile,
                                //     incrementPerIntensity: 1/40,
                                //     blur: 1,
                                //     scale: ['#ffffff', '#00ff00', '#ffff00', '#ff0000']
                                // });
                                //
                                // HeatMapLayer2.enabled = false;
                                // wwd.addLayer(HeatMapLayer2);
                                layerManager.synchronizeLayerList();

                                // console.log(wwd.layers[10]);

                                // placemark();
                                placemarkLayer();
                            }
                        }

                    }

                    function placemarkLayer() {

                        var placemarkLayer = new WorldWind.RenderableLayer("Custom Placemark");
                        var pushpin = "../../pic/plain-white.png";
                        var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
                        placemarkAttributes.imageSource = pushpin;
                        placemarkAttributes.imageScale = 0.5;

                        var highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
                        highlightAttributes.imageScale = 0.6;

                        for (var i = 0; i < resp.message.length; i++) {
                            var placemarkPosition = new WorldWind.Position(resp.message[i].latitude, resp.message[i].longitude, 0);
                            var placemark = new WorldWind.Placemark(placemarkPosition, false, placemarkAttributes);
                            placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                            placemark.highlightAttributes = highlightAttributes;

                            placemarkLayer.addRenderable(placemark);

                            if (i === resp.message.length - 1) {
                                wwd.addLayer(placemarkLayer);
                                console.log(wwd.layers);
                                layerManager.synchronizeLayerList();

                                // Listen for mouse double clicks placemarks and then pop up a new dialog box.
                                wwd.addEventListener("click", handleMouseCLK);
                            }
                        }
                    }

                    function handleMouseCLK(o) {

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
                                console.log(pickedPL.position);
                                autoZoom(pickedPL.position);
                            }
                        }

                        pickList = [];
                    }

                    function autoZoom(position) {
                        console.log(wwd.layers);
                        for (var i = 0; i < wwd.layers.length; i++) {
                            if (wwd.layers[i].displayName === "Custom Heatmap") {
                                wwd.layers[i].enabled = true;
                            } else if (wwd.layers[i].displayName === "Custom Placemark") {
                                wwd.layers[i].enabled = false;
                            }

                            if (i === wwd.layers.length - 1) {
                                wwd.goTo(new WorldWind.Position(position.latitude, position.longitude, 5000));
                                console.log(wwd.layers);
                                layerManager.synchronizeLayerList();
                                // wwd.removeEventListener("click", handleMouseCLK);
                            }
                        }

                    }

                    function placemark() {

                        // Create the renderable layer for placemarks.
                        var placemarkLayer = new WorldWind.RenderableLayer("Custom Placemark");

                        for (var i = 0; i < resp.message.length; i++) {
                            var canvas;

                            if (resp.message[i].cropHealth === "good") {
                                canvas = shape("rgba(0,255,0,1)");
                            } else if (resp.message[i].cropHealth === "medium") {
                                canvas = shape("rgba(255,255,0,1)");
                            } else if (resp.message[i].cropHealth === "poor") {
                                canvas = shape("rgba(255,0,0,1)");
                            }

                            // Set placemark attributes.
                            var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
                            // Wrap the canvas created above in an ImageSource object to specify it as the placemarkAttributes image source.
                            placemarkAttributes.imageSource = new WorldWind.ImageSource(canvas);

                            // Create the placemark with the attributes defined above.
                            var placemarkPosition = new WorldWind.Position(resp.message[i].latitude, resp.message[i].longitude);
                            var placemark = new WorldWind.Placemark(placemarkPosition, false, placemarkAttributes);
                            placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;

                            // Add the placemark to the layer.
                            placemarkLayer.addRenderable(placemark);

                            if (i === resp.message.length - 1) {
                                // Add the placemarks layer to the WorldWindow's layer list.
                                wwd.addLayer(placemarkLayer);
                                console.log(wwd.layers);
                            }
                        }
                    }

                    function shape(color) {
                        var circle = document.createElement("canvas");
                        var ctx = circle.getContext('2d');
                        circle.width = circle.height = 30;

                        var gradient = ctx.createRadialGradient(15, 15, 0, 15, 15, 15);
                        gradient.addColorStop(0, color);
                        gradient.addColorStop(1, color);

                        ctx.beginPath();
                        ctx.arc(15, 15, 15, 0, Math.PI * 2, true);

                        ctx.fillStyle = gradient;
                        ctx.fill();

                        ctx.closePath();

                        return circle;
                    }
                }
            });
        });
    });