const { ARTIFACTORY_AUTH, DS_GITHUB_PAT } = process.env;
const getGitHubCredentials = () => DS_GITHUB_PAT;

export { getGitHubCredentials };
