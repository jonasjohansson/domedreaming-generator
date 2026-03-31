import { initSplitView } from './split-view.js';
import { initViewport3D, updateDome } from './viewport-3d.js';
import { initViewport2D, render2D } from './viewport-2d.js';
import { generateGeodesic } from './geodesic.js';
import { unwrapMesh } from './unwrap.js';

initSplitView();
initViewport3D();
initViewport2D();

// Generate dome
const mesh = generateGeodesic({ frequency: 2, radius: 1, hemisphere: false, truncation: 0.5, rotation: 0 });
updateDome({ frequency: 2, radius: 1, hemisphere: false, truncation: 0.5, rotation: 0 });

// Unwrap and render 2D
const unwrapData = unwrapMesh({ mesh, layout: 'flower', gap: 0.1, clusterRotation: 0 });
render2D(unwrapData);

console.log('Dome Dreaming Generator initialized');
