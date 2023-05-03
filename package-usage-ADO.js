import fetch from "node-fetch";
import fs from "fs";

const companyName = process.argv[2];
const azureToken = process.argv[3];

const token = `Basic ${Buffer.from(`:${azureToken}`).toString("base64")}`;

const API_URL = `https://almsearch.dev.azure.com/${companyName}/_apis/search/codeQueryResults?api-version=6.0-preview.1`;

// Lit of packages you want find usage for. Eg. @itwin/itwinui-react. Use string array.
const packages = [
  ""
];

const today = new Date().toJSON().slice(0, 10);

const getFileContent = async (file) => {
  try {
    const response = await fetch(
      `https://dev.azure.com/${companyName}/${
        file.projectId
      }/_apis/git/repositories/${file.repositoryId}/Items?path=${encodeURI(
        file.path
      )}&recursionLevel=0&includeContentMetadata=true&latestProcessedChange=false&download=false&versionDescriptor%5BversionOptions%5D=0&versionDescriptor%5BversionType%5D=2&versionDescriptor%5Bversion%5D=${
        file.changeId
      }&includeContent=true&resolveLfs=true`,
      {
        method: "GET",
        headers: { Authorization: token, "Content-Type": "application/json" },
      }
    );
    return await response.text();
  } catch (err) {
    console.log(err);
  }
};

const findPackageVersion = async (file, packageName) => {
  try {
    const content = await getFileContent(file);
    const obj = JSON.parse(content);
    var version;
    if (obj.dependencies && obj.dependencies[packageName]) {
      version = obj.dependencies[packageName].replace("^", "").replace("~", "");
      return version;
    } else if (obj.devDependencies && obj.devDependencies[packageName]) {
      version = obj.devDependencies[packageName]
        .replace("^", "")
        .replace("~", "");
      return version;
    }
  } catch (err) {
    console.log(err);
  }
};

const search = async (packageName, skip, projectName, repositoryName) => {
  const filter = {};
  if (projectName) {
    filter.ProjectFilters = [projectName];
  }
  if (repositoryName) {
    filter.RepositoryFilters = [repositoryName];
  }
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        searchText: packageName,
        skipResults: skip,
        takeResults: 200,
        filters: [],
        searchFilters: filter,
        sortOptions: [],
        summarizedHitCountsNeeded: true,
        includeSuggestions: false,
        isInstantSearch: false,
      }),
      headers: { Authorization: token, "Content-Type": "application/json" },
    });
    const responseJson = await response.json();
    return responseJson;
  } catch (err) {
    console.log(err);
  }
};

const getUsageForPackage = async () => {
  packages.forEach(async (packageName) => {
    const initialResponse = await search(packageName, 0);
    const totalCount = initialResponse.results.count;
    let resultsProcessed = 0;
    const projects = initialResponse.filterCategories[0].filters.map(
      (filter) => filter.id
    );
    const appsUsing = [];
    for (let i = 0; i < projects.length; i++) {
      try {
        const projectName = projects[i];
        const initialProjectResponse = await search(
          packageName,
          0,
          projectName
        );
        const repositories =
          initialProjectResponse.filterCategories[1].filters.map(
            (filter) => filter.id
          );
        const repositoriesResults =
          initialProjectResponse.filterCategories[1].filters.map(
            (filter) => filter.resultCount
          );
        for (let j = 0; j < repositories.length; j++) {
          const repositoryName = repositories[j];
          let skip = 0;
          while (skip < repositoriesResults[j]) {
            const response = await search(
              packageName,
              skip,
              projectName,
              repositoryName
            );

            response.results.values
              .filter((val) => {
                return val.fileName === "package.json";
              })
              .map(async (val) => {
                await findPackageVersion(val, packageName).then((version) => {
                  version && !appsUsing.find((app) => app.name === val.repository && app.package === packageName && app.version === version) &&
                    appsUsing.push({
                      date: today,
                      name: val.repository,
                      version: version,
                      package: packageName,
                    });
                });
              });

            skip = response.results.values.length + skip;
            resultsProcessed += response.results.values.length;
            process.stdout.write(
              `\r${packageName}: ${resultsProcessed} out of ${totalCount} files scanned.`
            );
          }
        }
      } catch (err) {
        console.log(err);
      }
    }
    process.stdout.write(`\n`);
    const csvValues = appsUsing.map(
      (app) => `${app.date}, ${app.name}, ${app.package}, ${app.version}`
    );
    fs.appendFileSync(`./packageusage-${today}-raw.csv`, csvValues.join(`\n`));
  });
};

const main = async () => {
  try {
    fs.writeFileSync(
      `./packageusage-${today}-raw.csv`,
      `date, name, package, version \n`
    );
    await getUsageForPackage();
  } catch (error) {
    console.error(
      "Something went wrong. It might be that your token expired.",
      error
    );
  }
};

main();
