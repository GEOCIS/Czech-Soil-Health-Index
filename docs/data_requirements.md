# Data requirements and setup

## Point observations

See [data/examples/README.md](../data/examples/README.md) for the CSV format, the coordinate reference system and the example dataset.

The notebook expects the CSV in `holdingFolder`, named `<titleOfRawPointCollection>.csv`, with the columns set in `latString`, `longString` and `classProperty`.

## Earth Engine assets

### Shared assets (read only)

All assets below are in `projects/ee-geocisworldspecs-203/assets/` and are publicly readable.

| Asset | Used by | Role |
|---|---|---|
| `SyVI_RC_1984_2023` | notebook | Covariates (reflectance) |
| `TAGEE_RC_30m` | notebook | Covariates (terrain) |
| `MultiScaleTopographicPositionIndex_RC_90m` | notebook | Covariate (terrain) |
| `EuclideanDistance_toWater_RC_90m_ORD_STRA_3` | notebook | Covariate (distance to drainage) |
| `CHELSA_BIO_RC_90m` | notebook | Covariates (climate) |
| `example_composite_30ArcSec_RC_90m` | notebook | Stratification (`Resolve_Biome`) |
| `world_simplyfied` | notebook | Export tile grid |
| `RC_Limits` | `gee/00`–`03` | Czech Republic boundary |
| `Earthworms_Abundance` | `gee/01`, `gee/02` | Indicator (earthworm abundance) |
| `RC_<attribute>_PredictedImages_90m` | `gee/01`, `gee/02` | Prediction maps of the article (three bands: bootstrap mean, lower and upper limits; see the README) |
| `RC_<indicator>_MBI/LBI/OMI_90m` | `gee/03` | Indicator scores of the article |

The notebook also reads the public catalogue dataset `MERIT/DEM/v1_0_3`.

To check access, run the covariate cell of the notebook. It prints the number (24) and the names of the covariate bands. A permission error means that the asset is not shared publicly.

### Assets created by the notebook

For each run, the notebook creates the folder `<assetRootGEE>/<projectFolder>` containing:

| Asset | Type |
|---|---|
| `<classProperty>_training_data` | Table: uploaded observations |
| `<classProperty>_training_data_SpatialFiltered` | Table: observations within the bounding box |
| `<classProperty>_training_data_SpatialFiltered_export` | Table: observations with covariates and folds |
| `<classProperty>_grid_search_results_mean/` | Folder: one table per model (mean metrics) |
| `<classProperty>_grid_search_results_StDev/` | Folder: one table per model (standard deviation of metrics) |
| `<classProperty>_bootstrapSamples` | Table: bootstrap samples (no geometry) |
| `<classProperty>_PredictedImages` | ImageCollection: tiled prediction |

## Accounts and permissions

| Requirement | Used for |
|---|---|
| Earth Engine account and Google Cloud project (`projectIdGEE`) | API initialization, command-line tool, asset storage |
| Write access to `assetRootGEE` | Assets created by the notebook |
| Cloud Storage bucket with write and delete permission | Temporary upload of the bootstrap table |
| Google Drive | CSV exported by `gee/01_zonal_statistics.js` |
| Write access to the output root of the `gee/` scripts | Image assets of steps 2, 4 and 5 |

### Asset roots

New Earth Engine users must use a Cloud project root, `projects/<project-id>/assets`. Legacy roots (`users/<username>`) cannot be created by new accounts. Existing legacy users can set `assetRootGEE = 'users/<username>'`; the `users/` prefix is required.

### Cloud Storage bucket

The bootstrap table is too large to be sent directly from Python, so the notebook copies it to a Cloud Storage object, ingests it into Earth Engine and deletes the object immediately afterwards (also when the ingestion fails).

- Set `GCBbucketname` to the **bucket name only** (e.g. `my-bucket`) and, if needed, `GCSfolder` to a folder inside it (e.g. `temp/my_user`).
- The notebook first writes and deletes a small test file to check permissions.
- **Disable soft delete** on the bucket. Soft delete is enabled by default on new buckets and keeps deleted objects, which are still billed, for seven days.
- Optionally, add a lifecycle rule that deletes objects older than one day, as a safeguard for files left behind by an interrupted session.
- Use the Standard storage class, which has no minimum storage duration.
- Storage is billed to the project that owns the bucket. In a shared institutional bucket, the soft delete and lifecycle settings are controlled by the bucket administrators.

The Earth Engine credentials created by `ee.Authenticate()` include the Cloud Storage scope and are reused by the notebook.

## Outputs

### Notebook (local files)

| File | Folder |
|---|---|
| `<classProperty>_training_data.csv` | `holdingFolder` |
| `<classProperty>_training_data_SpatialFiltered.csv` | `holdingFolder` |
| `<classProperty>_bootstrapSamples.csv` | `holdingFolder` |
| `<classProperty>_training_data_SpatialFiltered_export.csv` | `outputFolder` |
| `<classProperty>_grid_search_results_mean.csv` | `outputFolder` |
| `<classProperty>_grid_search_results_StDev.csv` | `outputFolder` |
| `<classProperty>_featureImportances.csv` | `outputFolder` |

### Attributes of this study

| Attribute | `classProperty` | Output of `gee/00` | Output of `gee/02` |
|---|---|---|---|
| Total N | `MacroN_g_kg` | `RC_MacroN_g_kg_PredictedImages_90m` | `RC_MacroN_g_kg_MBI_90m` |
| Available P | `P_mgkg` | `RC_P_mgkg_PredictedImages_90m` | `RC_P_mgkg_MBI_90m` |
| Exchangeable K | `K_mmolkg` | `RC_K_mmolckg_PredictedImages_90m` | `RC_K_mmolckg_MBI_90m` |
| pH (H₂O) | `pH_H2O` | `RC_pH_H2O_PredictedImages_90m` | `RC_pH_H2O_OMI_90m` |
| Effective CEC | `CEC_Efe_mmolkg` | `RC_CEC_Efe_mmolckg_PredictedImages_90m` | `RC_CEC_mmolckg_MBI_90m` |
| SOC | `C_gkg` | `RC_SOC_gkg_PredictedImages_90m` | `RC_SOC_gkg_MBI_90m` |
| Bulk density | `Density_kgdm3` | `RC_BD_kgdm3_PredictedImages_90m` | `RC_BD_kgdm_LBI_90m` |
| Clay content (supporting map) | `Clay_gkg` | `RC_Clay_gkg_PredictedImages_90m` | — (not used in the SHI) |
| Earthworm abundance | — | — (external map) | `RC_Worms_MBI_90m` |

Each prediction map has three bands: `<classProperty>_PredictedBootstrapMean` (the published prediction, used in all subsequent steps), `<classProperty>_Predicted_lower` and `<classProperty>_Predicted_upper` (2.5th and 97.5th bootstrap percentiles). See [Bands of the predicted soil attribute maps](../README.md#bands-of-the-predicted-soil-attribute-maps).

The asset names are kept as in the published analysis, so they do not follow a single pattern (e.g. `mmolkg` in band names and `mmolckg` in asset names).

`gee/01` exports `RC_descriptive_statistics_organized.csv` to the Drive folder `RC_descriptive_statistics`. `gee/03` exports `RC_f1_90m`, `RC_f2_90m`, `RC_f3_90m` and `RC_SHI_90m`.
