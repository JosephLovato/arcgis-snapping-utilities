import { snapPointToPoints, snapPointToPolylinePaths, snapPointToPolylinePoints } from '../src/point_snapping';
import Graphic from '@arcgis/core/Graphic';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { Point, Polyline } from '@arcgis/core/geometry';
import { readFileSync } from 'fs';
import { parseString } from 'xml2js';

const sampleCoords = [
    [39.75018647, -104.9964148], [39.74806828, -104.9982449], [39.74924472, -104.9997856],
    [39.74338311, -104.9859939], [39.750918, -104.988358], [39.74139185, -104.9871921], [39.74949792, -104.9955454],
    [39.7480103, -104.9908666], [39.750075, -104.993585], [39.74646929, -104.991578], [39.751042, -105.000108],
    [39.7458006, -104.9907444], [39.740236, -105.001567], [39.73876078, -104.9915645], [39.751271, -105.000201],
    [39.751959, -105.00109], [39.74240991, -104.9885313], [39.74316802, -104.9893503], [39.7438391, -104.9902344],
    [39.74450747, -104.9910857], [39.74515404, -104.9919815], [39.74647076, -104.993709], [39.74715734, -104.9946061],
    [39.74783398, -104.9954195], [39.74844361, -104.9963922], [39.74909754, -104.9972234], [39.743198, -104.98209],
    [39.74874819, -104.9896949], [39.739975, -104.984252], [39.73814, -104.983662], [39.742597, -104.991089],
    [39.74559582, -104.9877345], [39.74156877, -104.9870645], [39.74129474, -104.9868463], [39.74118323, -104.9866934],
    [39.74095167, -104.986429], [39.74081082, -104.9864794], [39.74077385, -104.9867464], [39.74076577, -104.9870798],
    [39.74065845, -104.9869039], [39.74066842, -104.9866138], [39.747326, -104.977903], [39.74881211, -104.9890838],
    [39.75103277, -105.0023971], [39.746135, -104.980028], [39.75181757, -104.9937462], [39.74757252, -104.9902737],
    [39.74581072, -104.9928088], [39.746131, -104.986787], [39.750635, -104.986756], [39.74837306, -104.9966248],
    [39.74626401, -104.9886092], [39.74179637, -104.9879977], [39.73942106, -105.0027035], [39.74118399, -104.989239],
    [39.73840711, -104.9960349], [39.74494156, -104.9838544], [39.74491, -104.979029], [39.748135, -105.00042],
    [39.74020217, -104.9927171], [39.74588617, -104.98793], [39.74991234, -104.998459], [39.749044, -105.001287],
];

const kmlString = readFileSync('./test/rtd-route-0L.kml').toString();
const paths = [];
parseString(kmlString, (err, result) => {
    for (const obj of result.kml.Document[0].Folder[0].Placemark[0].MultiGeometry[0].LineString) {
        const coordsStr = String(obj.coordinates[0]);
        const coords = coordsStr.split(' ').map((str) => {
            const [longitudeStr, latitudeStr] = str.split(',');
            return [Number(latitudeStr), Number(longitudeStr)];
        });
        paths.push(coords);
    }
});

test('simple snap point to layer with two points', async () => {
    const point1 = new Graphic({
        geometry: new Point({
            latitude: 39.746993,
            longitude: -105.018279,
        }),
    });
    const point2 = new Graphic({
        geometry: new Point({
            latitude: 39.749501,
            longitude: -105.017450,
        }),
    });
    const featureLayer = new FeatureLayer({
        source: [point1, point2],
    });
    const pointToBeSnapped = new Point({
        latitude: 39.747554,
        longitude: -105.016827,
    });
    expect(snapPointToPoints(pointToBeSnapped, featureLayer)).toBe(true);
    expect(pointToBeSnapped.latitude).toEqual(point1.geometry.latitude);
    expect(pointToBeSnapped.longitude).toEqual(point1.geometry.longitude);
});

test('simple snap point to layer with many points', async () => {
    const graphics = sampleCoords.map(([lat, lon]) => {
        return new Graphic({
            geometry: new Point({
                latitude: lat,
                longitude: lon,
            }),
        });
    });
    const featureLayer = new FeatureLayer({
        source: graphics,
    });

    const pointToBeSnapped1 = new Point({
        latitude: 39.749147,
        longitude: -104.994883,
    });
    expect(snapPointToPoints(pointToBeSnapped1, featureLayer)).toBe(true);
    expect(pointToBeSnapped1.latitude).toEqual(39.74949792);
    expect(pointToBeSnapped1.longitude).toEqual(-104.9955454);

    const pointToBeSnapped2 = new Point({
        latitude: 39.7392355,
        longitude: -104.986202,
    });
    snapPointToPoints(pointToBeSnapped2, featureLayer);
    expect(pointToBeSnapped2.latitude).toEqual(39.74066842);
    expect(pointToBeSnapped2.longitude).toEqual(-104.9866138);
});

test('feature layer contains no point graphics', () => {
    const graphic1 = new Graphic({
        geometry: new Polyline({
            paths: [[[39.75018647, -104.9964148], [39.74806828, -104.9982449]]],
        }),
    });
    const graphic2 = new Graphic({
        geometry: new Polyline({
            paths: [[[39.74081082, -104.9864794], [39.74077385, -104.9867464]]],
        }),
    });
    const featureLayer = new FeatureLayer({
        source: [graphic1, graphic2],
    });
    const pointToBeSnapped = new Point({
        latitude: 39.7392355,
        longitude: -104.986202,
    });
    expect(snapPointToPoints(pointToBeSnapped, featureLayer)).toBe(false);
    expect(pointToBeSnapped.latitude).toEqual(39.7392355);
    expect(pointToBeSnapped.longitude).toEqual(-104.986202);
});

test('simple point to polyline points I', () => {
    const line = new Polyline({
        paths: paths,
    });

    const pointToBeSnapped = new Point({
        latitude: 39.7200722222,
        longitude: -104.98415,
    });

    snapPointToPolylinePoints(pointToBeSnapped, line);
    expect(pointToBeSnapped.latitude).toEqual(39.7193620087484);
    expect(pointToBeSnapped.longitude).toEqual(-104.986244999121);
});

test('simple point to polyline points II', () => {
    const line = new Polyline({
        paths: paths,
    });

    const pointToBeSnapped = new Point({
        latitude: 39.700071,
        longitude: -104.987445,
    });

    snapPointToPolylinePoints(pointToBeSnapped, line);
    expect(pointToBeSnapped.latitude).toEqual(39.7002460119593);
    expect(pointToBeSnapped.longitude).toEqual(-104.987499005935);
});

test('simple point to polyline points III', () => {
    const line = new Polyline({
        paths: paths,
    });

    const pointToBeSnapped = new Point({
        latitude: 39.74223,
        longitude: -104.98485,
    });

    snapPointToPolylinePoints(pointToBeSnapped, line);
    // console.log(pointToBeSnapped.latitude, ',', pointToBeSnapped.longitude);
    expect(pointToBeSnapped.latitude).toEqual(39.7416780071377);
    expect(pointToBeSnapped.longitude).toEqual(-104.986098983361);
});

test('simple point to empty polyline points', () => {
    const line = new Polyline({
        paths: [],
    });

    const pointToBeSnapped = new Point({
        latitude: 39.7200722222,
        longitude: -104.98415,
    });

    expect(snapPointToPolylinePoints(pointToBeSnapped, line)).toBe(false);
});

test('simple point to polyline paths I', () => {
    const line = new Polyline({
        paths: paths,
    });

    const pointToBeSnapped = new Point({
        latitude: 39.7200722222,
        longitude: -104.98415,
    });

    snapPointToPolylinePaths(pointToBeSnapped, line);
    expect(pointToBeSnapped.latitude).toEqual(39.72004456671402);
    expect(pointToBeSnapped.longitude).toEqual(-104.98625397095184);
});

test('simple point to polyline paths II', () => {
    const line = new Polyline({
        paths: paths,
    });

    const pointToBeSnapped = new Point({
        latitude: 39.700071,
        longitude: -104.987445,
    });

    snapPointToPolylinePaths(pointToBeSnapped, line);
    expect(pointToBeSnapped.latitude).toEqual(39.70024965669543);
    expect(pointToBeSnapped.longitude).toEqual(-104.9874631709949);
});

test('simple point to polyline paths III', () => {
    const line = new Polyline({
        paths: paths,
    });

    const pointToBeSnapped = new Point({
        latitude: 39.74223,
        longitude: -104.98485,
    });

    snapPointToPolylinePaths(pointToBeSnapped, line);
    expect(pointToBeSnapped.latitude).toEqual(39.7416780071377);
    expect(pointToBeSnapped.longitude).toEqual(-104.986098983361);
});

test('simple point to empty polyline paths', () => {
    const line = new Polyline({
        paths: [],
    });

    const pointToBeSnapped = new Point({
        latitude: 39.7200722222,
        longitude: -104.98415,
    });
    expect(snapPointToPolylinePaths(pointToBeSnapped, line)).toBe(false);
});

