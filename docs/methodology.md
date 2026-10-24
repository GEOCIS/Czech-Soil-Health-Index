# Methodology

This document describes what each script does, in execution order, with the parameter values used for the Czech Republic. Values marked *configurable* can be changed in the scripts; all other values reproduce the published analysis and should not be changed for that purpose.

## 1. Digital Soil Mapping — `notebooks/DSM_pipeline_ee_RC.ipynb`

Adapted by Raul R. Poppiel from the geospatial mapping pipeline of van den Hoogen et al. (2021). The notebook maps one soil attribute (`classProperty`) per run.

### 1.1 Study area and resolution

| Parameter | Value |
|---|---|
| Bounding box (`exportingGeometry`) | 10.5978–20.1559° E, 47.4599–52.1759° N |
| Coordinate reference system | EPSG:4326 |
| Sampling scale | 30 m (nominal scale of the reflectance composite) |
| Export resolution | 90 m, i.e. 90 / 111,319.49 degrees, with the global grid origin at −180°, 90° |
| Tile size of the export grid | 800 km |

### 1.2 Covariates

24 covariates are used (`covariateList`):

| Group | Asset | Bands |
|---|---|---|
| Reflectance (SYSI) | `SyVI_RC_1984_2023` | blue, green, red, nir, swir1, swir2 |
| Relief (TAGEE) | `TAGEE_RC_30m` | Elevation, Slope, Aspect, Hillshade, Northness, Eastness, HorizontalCurvature, VerticalCurvature, MeanCurvature, GaussianCurvature, MinimalCurvature, MaximalCurvature |
| Relief | `MultiScaleTopographicPositionIndex_RC_90m` | MultiScaleTopographicPositionIndex |
| Location | `EuclideanDistance_toWater_RC_90m_ORD_STRA_3` | EuclideanDistance_toWater |
| Climate (CHELSA) | `CHELSA_BIO_RC_90m` | CHELSA_BIO_Precipitation_Seasonality, CHELSA_BIO_Temperature_Annual_Range, CHELSA_BIO_Annual_Mean_Temperature, CHELSA_BIO_Annual_Precipitation |

The band `Resolve_Biome` of `example_composite_30ArcSec_RC_90m` is used only to stratify the cross-validation folds and the bootstrap samples; it is not a predictor.

### 1.3 Data preparation

1. The CSV is read, and only the latitude, longitude and attribute columns are kept.
2. Rows with missing values are removed and the attribute is rounded to `classProperty_roundTo` = 2 decimal places.
3. The table is uploaded to Earth Engine as a FeatureCollection of points (`<classProperty>_training_data`). If the request exceeds the Earth Engine payload limit, it is uploaded in parts of 5,000 rows that are merged into a single asset.
4. Points outside the bounding box are removed (`<classProperty>_training_data_SpatialFiltered`).
5. The covariates are sampled at each point with `ee.Reducer.first()` at 30 m.
6. **Pixel aggregation:** points are converted to an image and sampled back at 30 m, so that observations in the same pixel are replaced by their mean. Pixels with a missing covariate are dropped.
7. **Fold assignment:** within each biome, points are ordered by a random column (seed = biome code) and assigned to `k` = 10 folds (`CV_Fold`). The result is stored as `<classProperty>_training_data_SpatialFiltered_export`.

Optional (not used): log transformation of the attribute (`log_transform_classProperty = False`).

### 1.4 Hyperparameter tuning

Random Forest regression (`ee.Classifier.smileRandomForest`, output mode `REGRESSION`):

| Hyperparameter | Values |
|---|---|
| `numberOfTrees` | 20 |
| `variablesPerSplit` | 4, 8, 12, 16, 20, 24 |
| `minLeafPopulation` | 3, 6, 9 |
| `maxNodes` | 500, 1000, 1500 |
| `bagFraction` | 0.632 |
| `seed` | 42 |

Each of the 54 combinations is evaluated by 10-fold cross-validation. For each fold, the model is trained on the other nine folds and validated on the held-out fold, with:

- $R^2 = 1 - \dfrac{\sum (y - \hat{y})^2}{\sum (y - \bar{y})^2}$
- $RMSE = \sqrt{\dfrac{1}{n}\sum (y - \hat{y})^2}$
- $RPIQ = \dfrac{Q_3 - Q_1}{RMSE}$, where $Q_1$ and $Q_3$ are the quartiles of the observed values

The mean and standard deviation across folds are stored (`Mean_R2`, `Mean_RMSE`, `Mean_RPIQ`, `StDev_*`). The mean RMSE is computed as the square root of the mean squared fold RMSE. Models are ranked by `Mean_R2` (`sort_acc_prop`).

### 1.5 Variable importance

The top 10 models (`ensemble = True`) are trained on the full training data. The importance of each covariate (`explain()`) is min–max normalized within each model and averaged across models (`<classProperty>_featureImportances.csv`).

### 1.6 Bootstrap prediction and uncertainty

- `bootstrapIterations` = 100 samples, each with as many observations as the training data, drawn with replacement (seeds 1–100).
- Sampling is stratified by biome. The number of observations drawn from each biome is proportional to its share of the study area (`strataDict`: biome 4, Temperate Broadleaf & Mixed Forests, 90.91 %; biome 5, Temperate Conifer Forests, 9.09 %). These proportions must be recalculated for other study areas.
- The bootstrap table is written locally, copied to a temporary Cloud Storage object, ingested as `<classProperty>_bootstrapSamples` and deleted from the bucket.
- The **best model** of the grid search is trained on each bootstrap sample and applied to the covariates. The 100 predictions are reduced to their mean (`<classProperty>_PredictedBootstrapMean`) and to their 2.5th and 97.5th percentiles (`<classProperty>_Predicted_lower`, `<classProperty>_Predicted_upper`). The mean is the published prediction and the only band used in the subsequent steps; the percentiles define a 95 % bootstrap interval that can be used to map uncertainty. The bands are stored in this order (1: mean, 2: lower, 3: upper).

### 1.7 Interpolation and extrapolation (computed, not exported)

- **Univariate:** fraction of covariates whose pixel value is within the range of the training data.
- **Multivariate:** PCA of the standardized training covariates (components explaining 90 % of the variance, `propOfVariance`) and fraction of the pairwise PC convex hulls that contain each pixel.

The bootstrap standard deviation and coefficient of variation are also computed but not exported.

### 1.8 Export

The prediction and its confidence interval are masked with `MERIT/DEM/v1_0_3` and exported tile by tile (shard size 128, pyramiding policy `mean`) to the ImageCollection `<classProperty>_PredictedImages`.

### 1.9 Spatial leave-one-out cross-validation (optional, not used)

The notebook includes a SLOO-CV section (buffers of 10, 100, 1,000, 2,000 and 5,000 m; up to 150 test points). It was not used in this study and has known issues (see the README).

## 2. Mosaic — `gee/00_mosaic_predicted_images.js`

Run once per attribute. The tiles of the ImageCollection are combined with `mosaic()` and exported as a single Image asset with all bands (`<classProperty>_PredictedBootstrapMean`, `<classProperty>_Predicted_lower`, `<classProperty>_Predicted_upper`). The export uses the projection of the original tiles (EPSG:4326, 90 m), so the pixels are not resampled, and the bounding box of the Czech Republic as region.

## 3. Descriptive statistics — `gee/01_zonal_statistics.js`

For the bootstrap-mean maps of N, P, K, pH, CEC, SOC, bulk density and clay, and for the earthworm abundance map, `reduceRegion` computes the mean, standard deviation, minimum, maximum, pixel count and the 5th, 25th, 50th, 75th and 95th percentiles within the Czech Republic boundary (`RC_Limits`) at 90 m. The table is exported to Google Drive with one row per attribute. Clay is a supporting map: it is described here but is not normalized and does not enter the soil functions or the Soil Health Index. With the default settings of `02_normalization.js`, the P5, P50 and P95 columns are the parameters of the normalization.

## 4. Normalization — `gee/02_normalization.js`

### 4.1 Scoring functions

| Indicator | Map | Function |
|---|---|---|
| Total N | `RC_MacroN_g_kg_PredictedImages_90m` | More is better (MBI) |
| Available P | `RC_P_mgkg_PredictedImages_90m` | MBI |
| Exchangeable K | `RC_K_mmolckg_PredictedImages_90m` | MBI |
| Effective CEC | `RC_CEC_Efe_mmolckg_PredictedImages_90m` | MBI |
| SOC | `RC_SOC_gkg_PredictedImages_90m` | MBI |
| Earthworm abundance | `Earthworms_Abundance` | MBI |
| Bulk density | `RC_BD_kgdm3_PredictedImages_90m` | Less is better (LBI) |
| pH (H₂O) | `RC_pH_H2O_PredictedImages_90m` | Optimal midpoint (OMI) |

The equations are given in the README. Parameters:

| Symbol | Meaning | Value in this study | Setting |
|---|---|---|---|
| $a$ | Maximum score | 1 | fixed |
| $S$ | Slope | −2.5 | fixed |
| $B$ | Baseline, score 0.5 | median (P50) | fixed |
| $U_L$, $B_U$ | Upper limit / upper baseline | P95 | `UPPER_PERCENTILE` |
| $L_L$, $B_L$ | Lower limit / lower baseline | P5 | `LOWER_PERCENTILE` |
| $O$ | Optimal pH | 6.5 | `OPTIMUM_PH` |

The percentiles are computed with `reduceRegion` within the Czech Republic boundary at 90 m (`tileScale` = 4). Scores are clamped to [0, 1]. For pixels at or beyond the limits, the score is set to 1 explicitly, and the equations are evaluated only where they are defined.

### 4.2 Export

Each score map is clipped to the boundary and exported as a single-band (`constant`) float image at 90 m (EPSG:4326, `scale` = 90) over the bounding box of the boundary.

## 5. Soil functions and Soil Health Index — `gee/03_functions_and_shi.js`

| Function | Indicators and weights |
|---|---|
| $f_1$: storage, availability and cycling of nutrients | N 0.1333, P 0.1333, K 0.1333, pH 0.4, CEC 0.2 |
| $f_2$: carbon storage | Earthworms 0.5, SOC 0.5 |
| $f_3$: support for plant growth | BD 1 |
| SHI | $f_1$ 0.34, $f_2$ 0.33, $f_3$ 0.33 |

The functions and the SHI are weighted sums of the scores (equations in the README) and range from 0 to 1. They are exported at 90 m (`scale` = 90) with the extent and projection of the inputs.

## References

See the [Citation](../README.md#citation) section of the README.
