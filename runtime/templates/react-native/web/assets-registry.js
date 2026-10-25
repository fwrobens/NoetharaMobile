// Web shim for react-native-svg's optional asset lookup (images via require()).
const assets = [];
export function registerAsset(asset) { return assets.push(asset); }
export function getAssetByID(id) { return assets[id - 1]; }
