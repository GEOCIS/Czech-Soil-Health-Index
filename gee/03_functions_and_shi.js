// ============================================================
// 03 - Soil functions and Soil Health Index
// ============================================================
//
// Author: Merilyn T. A. Amorim
//
// Part of the spatial soil health assessment workflow for the Czech
// Republic, developed on the basis of the methodologies of:
//
//   Poppiel, R.R., Cherubin, M.R., Novais, J.J.M. et al. (2025).
//   Soil health in Latin America and the Caribbean.
//   Communications Earth & Environment, 6, 141.
//   https://doi.org/10.1038/s43247-025-02021-w
//
//   Greschuk, L.T., Dematte, J.A.M., Silvero, N.E.Q. et al. (2023).
//   A soil productivity system reveals most Brazilian agricultural
//   lands are below their maximum potential.
//   Scientific Reports, 13, 14103.
//   https://doi.org/10.1038/s41598-023-39981-y
//
// Environment: Google Earth Engine Code Editor (JavaScript API).
//
// Purpose:
//   Integrates the normalized soil indicators (scores 0-1) produced
//   by 02_normalization.js into three soil functions and combines the
//   functions into the Soil Health Index (SHI), using weighted sums:
//
//   f1 - Storage, availability and cycling of nutrients
//     f1 = 0.1333 N + 0.1333 P + 0.1333 K + 0.4 pH + 0.2 CEC
//     (N, P and K share a total weight of 0.4: 0.4/3 each)
//
//   f2 - Carbon storage
//     f2 = 0.5 Earthworms + 0.5 SOC
//
//   f3 - Support for plant growth
//     f3 = BD
//
//   Soil Health Index
//     SHI = 0.34 f1 + 0.33 f2 + 0.33 f3
//
//   where N, P, K, CEC, SOC and Earthworms are More is Better scores,
//   pH is the Optimal Midpoint score and BD is the Less is Better
//   score of bulk density. The weights of each function and of the
//   SHI sum to 1, so all outputs range from 0 to 1.
//
// Inputs (Image assets created by 02_normalization.js, band "constant"):
//   RC_MacroN_g_kg_MBI_90m, RC_P_mgkg_MBI_90m, RC_K_mmolckg_MBI_90m,
//   RC_pH_H2O_OMI_90m, RC_CEC_mmolckg_MBI_90m, RC_SOC_gkg_MBI_90m,
//   RC_Worms_MBI_90m, RC_BD_kgdm_LBI_90m
//
// Outputs (Image assets, band "constant", 90 m):
//   RC_f1_90m, RC_f2_90m, RC_f3_90m, RC_SHI_90m
//
// Note: a pixel without a valid value in any indicator (e.g., outside
// the coverage of the earthworm map) is masked in the corresponding
// function and in the SHI.
// ============================================================

// Study area: Czech Republic boundary
var bbox = ee.FeatureCollection(
  "projects/ee-geocisworldspecs-203/assets/RC_Limits"
);


// ------------------------------------------------------------
// Load normalized maps
// ------------------------------------------------------------

var N_MBI = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_MacroN_g_kg_MBI_90m"
).clip(bbox);


var P_MBI = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_P_mgkg_MBI_90m"
).clip(bbox);


var K_MBI = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_K_mmolckg_MBI_90m"
).clip(bbox);


var pH_OMI = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_pH_H2O_OMI_90m"
).clip(bbox);


var CEC_MBI = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_CEC_mmolckg_MBI_90m"
).clip(bbox);


var SOC_MBI = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_SOC_gkg_MBI_90m"
).clip(bbox);


var Worms_MBI = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_Worms_MBI_90m"
).clip(bbox);


var BD_LBI = ee.Image(
  "projects/ee-geocisworldspecs-203/assets/RC_BD_kgdm_LBI_90m"
).clip(bbox);


// ------------------------------------------------------------
// Soil functions
// ------------------------------------------------------------


// Storage, availability, and cycling of nutrients
function f1(N, P, K, pH, CEC) {

  return ee.Image().expression(

    "(P * 0.133333333333333) + " +
    "(K * 0.133333333333333) + " +
    "(N * 0.133333333333333) + " +
    "(pH * 0.4) + " +
    "(CEC * 0.2)",

    {
      "N": N,
      "P": P,
      "K": K,
      "pH": pH,
      "CEC": CEC
    }
  );
}


// Carbon storage
function f2(Earthworms, SOC) {

  return ee.Image().expression(

    "(Earthworms * 0.5) + (SOC * 0.5)",

    {
      "Earthworms": Earthworms,
      "SOC": SOC
    }
  );
}


// Support for plant growth
function f3(BD) {

  return BD;
}


// ------------------------------------------------------------
// Calculate subfunctions
// ------------------------------------------------------------

var f1_map = f1(
  N_MBI,
  P_MBI,
  K_MBI,
  pH_OMI,
  CEC_MBI
).rename("constant");


var f2_map = f2(
  Worms_MBI,
  SOC_MBI
).rename("constant");


var f3_map = f3(
  BD_LBI
).rename("constant");


// ------------------------------------------------------------
// Visualization
// ------------------------------------------------------------

Map.addLayer(
  f1_map,
  {min: 0, max: 1},
  "Storage, availability, and cycling of nutrients"
);

Map.addLayer(
  f2_map,
  {min: 0, max: 1},
  "Carbon storage"
);

Map.addLayer(
  f3_map,
  {min: 0, max: 1},
  "Support for plant growth"
);


// ------------------------------------------------------------
// Soil Health Index
// ------------------------------------------------------------

function SHI(f1_car, f2_car, f3_car) {

  return ee.Image().expression(

    "(f1_car * 0.34) + " +
    "(f2_car * 0.33) + " +
    "(f3_car * 0.33)",

    {
      "f1_car": f1_car,
      "f2_car": f2_car,
      "f3_car": f3_car
    }
  );
}


var SHI_map = SHI(
  f1_map,
  f2_map,
  f3_map
).rename("constant");


Map.addLayer(
  SHI_map,
  {min: 0, max: 1},
  "Soil Health Index"
);


// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

var maxPixels = 10000000000000;
var scale = 90;


Export.image.toAsset({
  image: f1_map,
  description: "RC_f1_90m",
  assetId:
    "projects/ee-geocisworldspecs-203/assets/RC_f1_90m",
  scale: scale,
  maxPixels: maxPixels
});


Export.image.toAsset({
  image: f2_map,
  description: "RC_f2_90m",
  assetId:
    "projects/ee-geocisworldspecs-203/assets/RC_f2_90m",
  scale: scale,
  maxPixels: maxPixels
});


Export.image.toAsset({
  image: f3_map,
  description: "RC_f3_90m",
  assetId:
    "projects/ee-geocisworldspecs-203/assets/RC_f3_90m",
  scale: scale,
  maxPixels: maxPixels
});


Export.image.toAsset({
  image: SHI_map,
  description: "RC_SHI_90m",
  assetId:
    "projects/ee-geocisworldspecs-203/assets/RC_SHI_90m",
  scale: scale,
  maxPixels: maxPixels
});

