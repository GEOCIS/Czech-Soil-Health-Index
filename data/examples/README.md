# Example dataset: `RC_LUCAS_C_gkg.csv`

Topsoil organic carbon observations from the LUCAS soil survey, prepared as an example input for `notebooks/DSM_pipeline_ee_RC.ipynb`.

> **This file is not the training dataset of the article.** The maps of the article were trained with additional data that are confidential and cannot be shared. The example reproduces the input format and allows the complete DSM step to be run.

## Content

| Column | Type | Description |
|---|---|---|
| `ID_Original` | integer | LUCAS point identifier |
| `X` | float | Longitude, decimal degrees, WGS 84 (EPSG:4326) |
| `Y` | float | Latitude, decimal degrees, WGS 84 (EPSG:4326) |
| `C_gkg` | float | Soil organic carbon content, g kg⁻¹ (one decimal place) |

- 1,324 observations, no missing values, no duplicated identifiers or coordinates.
- Longitude 11.16–19.83° E, latitude 47.73–52.00° N: all points fall within the study bounding box of the notebook (10.60–20.16° E, 47.46–52.18° N).
- Organic carbon ranges from 2.2 to 125.0 g kg⁻¹ (mean 26.8 g kg⁻¹).

**Coordinate reference system.** The coordinates were checked against the LUCAS point identifiers, which encode the position of each point on the LUCAS grid in the ETRS89-LAEA projection (EPSG:3035, in kilometres). After projecting `X`/`Y` from EPSG:4326 to EPSG:3035, 99.9 % of the points lie within 2 km of the grid node given by their identifier, which confirms that `X` is longitude and `Y` is latitude in WGS 84.

**Spatial coverage.** The points cover the whole bounding box, not only the Czech Republic. Using the Natural Earth 1:50m country boundaries, about 456 points are in the Czech Republic, 276 in Germany, 228 in Poland, 225 in Austria, 132 in Slovakia and 7 in Hungary. The notebook keeps all points within the bounding box for training; the later steps restrict the analysis to the Czech Republic boundary.

## Using the example

Copy the file into the folder set as `holdingFolder` in the notebook (default `./data`) and set:

```python
titleOfRawPointCollection = 'RC_LUCAS_C_gkg'   # file name without '.csv'
classProperty = 'C_gkg'                        # attribute column
latString = 'Y'                                # latitude column
longString = 'X'                               # longitude column
projectFolder = 'RC_C_gkg'                     # GEE folder created for this attribute
```

`ID_Original` is ignored by the notebook. No change to the code is needed.

## Preparing your own data

- One CSV file per soil attribute, comma-separated, with a header row.
- Coordinates in decimal degrees, WGS 84 (EPSG:4326). Reproject other coordinate systems before running the notebook.
- One numeric attribute column whose name has no spaces; it becomes `classProperty` and is used in the names of all assets and bands (e.g. `C_gkg_PredictedBootstrapMean`).
- Rows with missing values are removed, and values are rounded to `classProperty_roundTo` decimal places (default 2).
- Points outside the bounding box `exportingGeometry` are discarded, and points falling in the same 30 m pixel are averaged.

## Source, conditions of use and citation

The data are derived from the LUCAS topsoil survey, distributed by the European Soil Data Centre (ESDAC) of the European Commission's Joint Research Centre: https://esdac.jrc.ec.europa.eu/

LUCAS soil data are provided under a licence agreement that must be accepted when the data are requested from ESDAC. The agreement grants each user a personal, non-transferable right of use, asks users not to pass the data on to third parties, and requires a specific acknowledgment in publications.
Cite the data as:

- Panagos, P., van Liedekerke, M., Borrelli, P., Köninger, J., Ballabio, C., Orgiazzi, A., Lugato, E., Liakos, L., Hervas, J., Jones, A., & Montanarella, L. (2022). European Soil Data Centre 2.0: Soil data and knowledge in support of the EU policies. *European Journal of Soil Science*, 73(6), e13315. https://doi.org/10.1111/ejss.13315
- Panagos, P., van Liedekerke, M., Jones, A., & Montanarella, L. (2012). European Soil Data Centre: Response to European policy support and public data requirements. *Land Use Policy*, 29(2), 329–338. https://doi.org/10.1016/j.landusepol.2011.07.003
- Panagos, P., Vieira, D., Eekhout, J.P.C., Biddoccu, M., Cerdà, A., Evans, D.L., Tavoularis, N., Bezak, N., Negrel, P., Katsoyiannis, A., & Borrelli, P. (2024). How the EU Soil Observatory contributes to a stronger soil erosion community. *Environmental Research*, 248, 118319. https://doi.org/10.1016/j.envres.2024.118319

