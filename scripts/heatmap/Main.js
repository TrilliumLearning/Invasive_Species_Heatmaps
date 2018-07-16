requirejs(['./worldwind.min',
        './LayerManager',
        './RadiantCircleTile'],
    function (WorldWind,
              LayerManager,
              RadiantCircleTile) {
        "use strict";

        var table = $("#dataDisplay").DataTable();
        var latilong;
        var idFilter;

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
            // console.log($("#canvasOne").width());
            // var data = table.rows('.selected').data();
            // console.log(data.length);
            // console.log(data);
            // if ()
            // var latitude = table.rows('.selected').data()[0][1];
            // var longitude = table.rows('.selected').data()[0][2];
            // console.log(latitude + ", " + longitude);

            var data = table.rows('.selected').data();
            var placemark = wwd.layers[11].renderables;
            var originalSize = true;

            // console.log(placemark);
            // console.log(data[0][0]);

            for (var i = 0; i < placemark.length; i++) {

                if (data.length === 0 && placemark[i].attributes.imageScale === 1.0) {
                    drawPlacemark(i, placemark, 0.5, 0.6);
                    break;
                }

                for (var z = 0; z < data.length; z++) {
                    if (placemark[i].userProperties === data[z][0]) {
                        // console.log(placemark[i].userProperties);
                        if (placemark[i].attributes.imageScale === 0.5) {
                            console.log(placemark[i].userProperties + " A");
                            drawPlacemark(i, placemark, 1.0, 1.2);
                            wwd.goTo(new WorldWind.Position(placemark[i].position.latitude, placemark[i].position.longitude, 10000000));
                            // console.log(placemark);
                        }
                        originalSize = false;
                        break;
                    } else {
                        if (z === data.length - 1) {
                            // console.log(originalSize + " " + placemark[i].attributes.imageScale);
                            if (originalSize && placemark[i].attributes.imageScale === 1.0) {
                                // console.log(placemark[i]);
                                console.log(placemark[i].userProperties + " C");
                                // console.log(placemark);
                                drawPlacemark(i, placemark, 0.5, 0.6);
                            }

                            originalSize = true;
                        }
                    }
                }
            }

            function drawPlacemark(i, placemark, imageScale, highlightScale) {

                var info = placemark[i];

                placemark.splice(i, 1);

                var canvas = document.createElement("canvas"),
                    ctx2d = canvas.getContext("2d"),
                    size = 64, c = size / 2  - 0.5, innerRadius = 5, outerRadius = 20;

                canvas.width = size;
                canvas.height = size;

                var gradient = ctx2d.createRadialGradient(c, c, innerRadius, c, c, outerRadius);
                gradient.addColorStop(0, 'rgb(204, 255, 255)');
                gradient.addColorStop(0.5, 'rgb(102, 153, 255)');
                gradient.addColorStop(1, 'rgb(102, 0, 255)');

                ctx2d.fillStyle = gradient;
                ctx2d.arc(c, c, outerRadius, 0, 2 * Math.PI, false);
                ctx2d.fill();

                var placemarkAttributess = new WorldWind.PlacemarkAttributes(null);
                placemarkAttributess.imageSource = new WorldWind.ImageSource(canvas);
                placemarkAttributess.imageScale = imageScale;

                var highlightAttributess = new WorldWind.PlacemarkAttributes(placemarkAttributess);
                highlightAttributess.imageScale = highlightScale;

                var placemarkPositions = new WorldWind.Position(info.position.latitude, info.position.longitude, 0);
                var placemarks = new WorldWind.Placemark(placemarkPositions, false, placemarkAttributess);
                placemarks.userProperties = info.userProperties;
                placemarks.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                placemarks.highlightAttributes = highlightAttributess;
                wwd.layers[11].addRenderable(placemarks);

                // console.log(wwd.layers[11].renderables[i]);

                placemark.splice(i, 0, placemark[placemark.length - 1]);
                placemark.splice(placemark.length - 1, 1);

                // console.log(wwd.layers[11].renderables[i]);
            }

        });

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

                    var xOffset=Math.max(document.documentElement.scrollLeft,document.body.scrollLeft);
                    var yOffset=Math.max(document.documentElement.scrollTop,document.body.scrollTop);

                    var popover = document.getElementById('popover');
                    popover.style.position = "absolute";
                    popover.style.left = (x + xOffset) + 'px';
                    popover.style.top = (y + yOffset) + 'px';

                    // console.log(table.columns(0).data());

                    var indexes = table.rows().eq(0).filter( function (rowIdx) {
                        return table.cell(rowIdx, 0).data() === pickedPL.userProperties ? true : false;
                    } );

                    // console.log(indexes);
                    // console.log(table.rows(indexes).data());

                    var data = table.rows(indexes).data()[0];


                    var content = "<p><strong>Date :</strong> " + data[1] +
                        "<br>" + "<strong>Country :</strong> " + data[2] +
                        "<br>" + "<strong>Main Crop :</strong> " + data[3] +
                        "<br>" + "<strong>Crop System :</strong> " + data[6] +
                        "<br>" + "<strong>Total FAW :</strong> " + data[10] + "</p>";

                    $("#popover").attr('data-content', content);
                    $("#popover").show();

                    latilong = pickedPL.position;
                    idFilter = pickedPL.userProperties;
                }
            }

            pickList = [];
        }

        $("#popover").on("click", function () {
            console.log("Z");
            autoZoom(latilong, idFilter);
        });

        function handleMouseCLK(o) {

            // The input argument is either an Event or a TapRecognizer. Both have the same properties for determining
            // the mouse or tap location.
            var x = o.clientX,
                y = o.clientY;

            // Perform the pick. Must first convert from window coordinates to canvas coordinates, which are
            // relative to the upper left corner of the canvas rather than the upper left corner of the page.
            // console.log(o.x, o.clientX, o.layerX, o.offsetX, o.pageX, o.screenX);
            // console.log(o.y, o.clientY, o.layerY, o.offsetY, o.pageY, o.screenY);
            // console.log(x + ", " + y + "   " + wwd.canvasCoordinates(x, y));
            var pickList = wwd.pick(wwd.canvasCoordinates(x, y));
            // console.log(pickList.objects.length);
            for (var q = 0; q < pickList.objects.length; q++) {
                var pickedPL = pickList.objects[q].userObject;
                // console.log(pickedPL);
                if (pickedPL instanceof WorldWind.Placemark) {
                    // console.log(pickedPL);
                    console.log("A");
                    autoZoom(pickedPL.position, pickedPL.userProperties);
                }
            }

            pickList = [];
        }

        function autoZoom(position, id) {
            // console.log(wwd.layers);
            wwd.goTo(new WorldWind.Position(position.latitude, position.longitude, 5000));
            for (var i = 0; i < wwd.layers.length; i++) {
                if (wwd.layers[i].displayName === "Custom Heatmap") {
                    wwd.layers[i].enabled = true;
                } else if (wwd.layers[i].displayName === "Custom Placemark") {
                    wwd.layers[i].enabled = false;
                }

                if (i === wwd.layers.length - 1) {
                    table.columns(0).search(id).draw();
                    // console.log(wwd.layers);
                    layerManager.synchronizeLayerList();
                    // wwd.removeEventListener("click", handleMouseCLK);
                    $("#buttons").append($("<button type='button' id='return'>Return</button>"));

                    $("#return").on("click", function () {
                        wwd.goTo(new WorldWind.Position(0, 0, 10000000));

                        for (var i = 0; i < wwd.layers.length; i++) {
                            if (wwd.layers[i].displayName === "Custom Heatmap") {
                                wwd.layers[i].enabled = false;
                            } else if (wwd.layers[i].displayName === "Custom Placemark") {
                                wwd.layers[i].enabled = true;
                            }

                            if (i === wwd.layers.length - 1) {
                                table.search("").columns().search("").draw();
                                layerManager.synchronizeLayerList();
                                $("#return").remove();
                            }
                        }
                    });
                }
            }
        }

        $("#loadHeatmap").on("click", function () {
            var data = {'startDate': document.getElementById("startDate").value, 'endDate': document.getElementById("endDate").value};
            $.ajax({
                url: 'http://localhost:9087/heatmapData',
                type: 'GET',
                dataType: 'json',
                data: data,
                async: false,
                success: function (resp) {
                    wwd.goTo(new WorldWind.Position(0, 0, 10000000));

                    var latitude = [];
                    var longitude = [];
                    var intensities = [];
                    var min = Infinity;
                    var max = -Infinity;

                    // var health = [];

                    // date, country, cropMain, cropIrrigation, cropStage, cropSystem, cropFieldSize, cropFieldSizeUnit, rainAmount, totalFAW

                    // var table = $("#dataDisplay").DataTable();

                    for (var i = 0; i < resp.message.length; i++) {
                        latitude[i] = resp.message[i].latitude;
                        longitude[i] = resp.message[i].longitude;
                        intensities[i] = resp.message[i].intensity;

                        max = Math.max(intensities[i], max);
                        min = Math.min(intensities[i], min);

                        table.row.add([
                            resp.message[i]._id,
                            // resp.message[i].latitude,
                            // resp.message[i].longitude,
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
                            table.columns([]).visible(false);
                            drawHeatMap();
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
                        // var data2 = [];
                        for (var i = 0; i < intensities.length; i++) {
                            data[i] = new WorldWind.IntensityLocation(latitude[i], longitude[i], intensities[i]);
                            // data2[i] = new WorldWind.IntensityLocation(latitude[i], longitude[i], health[i]);
                            if (i === intensities.length - 1) {
                                console.log(data);

                                // var testData = [new WorldWind.IntensityLocation(-1, -1, 15), new WorldWind.IntensityLocation(1, -1, 15), new WorldWind.IntensityLocation(-1, 1, 15), new WorldWind.IntensityLocation(1, 1, 15)];
                                // var testData = [new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1), new WorldWind.IntensityLocation(0, 0, 1)];

                                var HeatMapLayer = new WorldWind.HeatMapLayer("Custom Heatmap", data, {
                                    tile: RadiantCircleTile,
                                    incrementPerIntensity: 1/50,
                                    blur: 10,
                                    scale: ['#000000', '#ffffff', '#00ff00', '#ffff00', '#ff0000']
                                });

                                HeatMapLayer.enabled = false;
                                wwd.addLayer(HeatMapLayer);
                                layerManager.synchronizeLayerList();
                                console.log(wwd);
                                placemarkLayer();
                            }
                        }

                    }

                    function placemarkLayer() {
                        var canvas = document.createElement("canvas"),
                            ctx2d = canvas.getContext("2d"),
                            size = 64, c = size / 2  - 0.5, innerRadius = 5, outerRadius = 20;

                        canvas.width = size;
                        canvas.height = size;

                        var gradient = ctx2d.createRadialGradient(c, c, innerRadius, c, c,   outerRadius);
                        gradient.addColorStop(0, 'rgb(204, 255, 255)');
                        gradient.addColorStop(0.5, 'rgb(102, 153, 255)');
                        gradient.addColorStop(1, 'rgb(102, 0, 255)');

                        ctx2d.fillStyle = gradient;
                        ctx2d.arc(c, c, outerRadius, 0, 2 * Math.PI, false);
                        ctx2d.fill();

                        var placemarkLayer = new WorldWind.RenderableLayer("Custom Placemark");
                        // var pushpin = "../../pic/plain-white.png";
                        var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
                        placemarkAttributes.imageSource = new WorldWind.ImageSource(canvas);
                        placemarkAttributes.imageScale = 0.5;

                        var highlightAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
                        highlightAttributes.imageScale = 0.6;

                        for (var i = 0; i < resp.message.length; i++) {
                            var placemarkPosition = new WorldWind.Position(resp.message[i].latitude, resp.message[i].longitude, 0);
                            var placemark = new WorldWind.Placemark(placemarkPosition, false, placemarkAttributes);
                            placemark.userProperties = resp.message[i]._id;
                            // placemark.label = resp.message[i]._id;
                            placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                            placemark.highlightAttributes = highlightAttributes;
                            // console.log(placemark);
                            placemarkLayer.addRenderable(placemark);

                            if (i === resp.message.length - 1) {
                                // wwd.layers[11].renderables[0].attributes._imageScale = 1.0;
                                wwd.addLayer(placemarkLayer);
                                console.log(wwd.layers);
                                layerManager.synchronizeLayerList();

                                // console.log(wwd.layers[11].renderables[0].activeAttributes);
                                // console.log(wwd.layers[11].renderables[0].attributes);
                                // wwd.layers[11].renderables[0].position.latitude = "0";
                                // wwd.layers[11].renderables[0].position.longitude = "0";
                                // wwd.layers[11].renderables[0].attributes.imageSource = "../../pic/plain-red.png";
                                // wwd.layers[11].renderables.splice(0, 1);
                                // console.log(wwd.layers[11].renderables[0]);
                                // console.log(wwd.layers[11].renderables);
                                //
                                // // var pushpins = "../../pic/plain-white.png";
                                // var placemarkAttributess = new WorldWind.PlacemarkAttributes(null);
                                // placemarkAttributess.imageSource = new WorldWind.ImageSource(canvas);
                                // placemarkAttributess.imageScale = 1;
                                //
                                // var highlightAttributess = new WorldWind.PlacemarkAttributes(placemarkAttributess);
                                // highlightAttributess.imageScale = 1.2;
                                //
                                // var placemarkPositions = new WorldWind.Position(0, 0, 0);
                                // var placemarks = new WorldWind.Placemark(placemarkPositions, false, placemarkAttributess);
                                // placemarks.userProperties = resp.message[i]._id;
                                // placemarks.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                                // placemarks.highlightAttributes = highlightAttributess;
                                // wwd.layers[11].addRenderable(placemarks);
                                //
                                // console.log(wwd.layers[11].renderables[0]);
                                // console.log(wwd.layers[11].renderables);


                                // // Listen for mouse double clicks placemarks and then pop up a new dialog box.
                                // wwd.addEventListener("click", handleMouseCLK);
                                //
                                // $("#popover").popover({html: true, placement: "top", trigger: "hover"});
                                //
                                // // Listen for mouse moves and highlight the placemarks that the cursor rolls over.
                                // wwd.addEventListener("mousemove", handleMouseMove);
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