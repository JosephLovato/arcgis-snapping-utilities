/* eslint-disable no-unused-vars */
import { Point } from '@arcgis/core/geometry';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import { Polyline } from '@arcgis/core/geometry';
import { EARTH_AVG_RADIUS } from './consts';

/**
 * Returns unitless distance between two latitude/longitude points
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @return {number}
 */
function distanceBetween(lat1, lon1, lat2, lon2) {
    // use equirectangular approximation for distance between two lat/long points
    // credit and more info: https://www.movable-type.co.uk/scripts/latlong.html
    const latrad1 = (Math.PI * lat1) / 180;
    const lonrad1 = (Math.PI * lon1) / 180;
    const latrad2 = (Math.PI * lat2) / 180;
    const lonrad2 = (Math.PI * lon2) / 180;
    const x = (lonrad2 - lonrad1) * Math.cos((latrad1 + latrad2) / 2);
    const y = latrad2 - latrad1;
    // NOTE not multiplying by radius because it is a constant factor
    return Math.sqrt(x * x + y * y);
}

/**
 * Snap a Point geometry to the nearest point geometry in a FeatureLayer
 * @param {Point} point
 * @param {FeatureLayer} featureLayer
 * @return {Boolean} whether the snapping was successful
 */
export function snapPointToPoints(point, featureLayer) {
    const pointFeatures = featureLayer.source.filter((f) => f.geometry.type == 'point');
    if (pointFeatures.length == 0) {
        return false;
    }

    // find closest point graphic in feature layer to given point
    let closestLayerGraphic = pointFeatures.at(0);
    let closestDistance = Number.MAX_SAFE_INTEGER;
    for (const layerGraphic of pointFeatures) {
        const distance = distanceBetween(point.latitude, point.longitude,
            layerGraphic.geometry.latitude, layerGraphic.geometry.longitude);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestLayerGraphic = layerGraphic;
        }
    }

    // snap graphic to closest feature layer graphic
    point.latitude = closestLayerGraphic.geometry.latitude;
    point.longitude = closestLayerGraphic.geometry.longitude;
    return true;
}

/**
 * Snap a Point geometry to the nearest point on a Polyline geometry
 * @param {Point} point
 * @param {Polyline} polyline
 * @return {Boolean} whether the snapping was successful
 */
export function snapPointToPolylinePoints(point, polyline) {
    const allPoints = polyline.paths.flat();
    if (allPoints.length == 0) {
        return false;
    }

    // find closest point in polyline to given point
    let closestDistance = Number.MAX_SAFE_INTEGER;
    let [closestLon, closestLat] = [0, 0];
    for (const [latitude, longitude] of allPoints) {
        const distance = distanceBetween(point.latitude, point.longitude,
            latitude, longitude);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestLon = longitude;
            closestLat = latitude;
        }
    }
    // snap graphic to closest point in polyline
    point.latitude = closestLat;
    point.longitude = closestLon;
    return true;
}

/**
 * Snap a Point geometry to the nearest path on the polyline
 * {@link snapPointToPolylinePoints} strictly snaps to points
 * while this function can snap to the actual line between the points
 * defining each path in the polyline
 * @param {Point} point
 * @param {Polyline} polyline
 * @return {Boolean} whether the snapping was successful
 */
export function snapPointToPolylinePaths(point, polyline) {
    if (polyline.paths.length == 0) {
        return false;
    }

    let closestDistance = Number.MAX_SAFE_INTEGER;
    let [closestLon, closestLat] = [0, 0];
    for (const path of polyline.paths) {
        if (path.length == 0) {
            return false;
        }
        for (let i = 0; i < path.length - 1; i++) {
            // point one is current point
            const [oneLat, oneLon] = path[i];
            // point two is next adjacent point in path
            const [twoLat, twoLon] = path[i + 1];

            // calculate distance from the point to these these two points
            const pointToOneDistance = distanceBetween(point.latitude, point.longitude, oneLat, oneLon) * EARTH_AVG_RADIUS;
            const pointToTwoDistance = distanceBetween(point.latitude, point.longitude, twoLat, twoLon) * EARTH_AVG_RADIUS;

            // using equirectangular projection, need to multiply
            // latitudes by cosine of latitude we want to be true scale
            const avgCosine = Math.cos(((oneLat + twoLat + point.latitude) / 3) * (Math.PI / 180));
            // define slope of line between points one and two
            const m = (oneLat - twoLat) / ((oneLon - twoLon) * avgCosine);

            // check that the point is within the bounds where the distance to the
            // path could be less than the distances to points one and two
            const mNegReciprocal = -(1 / m);
            const oneIntercept = oneLat - (mNegReciprocal * oneLon);
            const twoIntercept = twoLat - (mNegReciprocal * twoLon);
            let inBounds = true;
            if (oneIntercept > twoIntercept) {
                if (point.latitude > ((point.longitude * mNegReciprocal) + oneIntercept) ||
                    point.latitude < ((point.longitude * mNegReciprocal) + twoIntercept)) {
                    inBounds = false;
                }
            } else {
                if (point.latitude > ((point.longitude * mNegReciprocal) + twoIntercept) ||
                    point.latitude < ((point.longitude * mNegReciprocal) + oneIntercept)) {
                    inBounds = false;
                }
            }
            if (inBounds) {
                // calculate latitude (y) and longitude (x) of closest point on path
                // from the given point
                const intercept = oneLat - (m * oneLon);
                const x = (point.longitude + ((point.latitude) * m) - (intercept * m)) /
                    ((m * m) + 1);
                const y = (m * x) + intercept;

                // calculate distance from given point to closest point on path
                const distance = distanceBetween(y, x, point.latitude, point.longitude) * EARTH_AVG_RADIUS;

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestLat = y;
                    closestLon = x;
                    continue;
                }
            }
            // update closest point if a closer one was found
            if (pointToOneDistance < closestDistance) {
                closestDistance = pointToOneDistance;
                closestLat = oneLat;
                closestLon = oneLon;
            } else if (pointToTwoDistance < closestDistance) {
                closestDistance = pointToTwoDistance;
                closestLat = twoLat;
                closestLon = twoLon;
            }
        }
    }
    // snap graphic to closest point found
    point.latitude = closestLat;
    point.longitude = closestLon;
    return true;
}


