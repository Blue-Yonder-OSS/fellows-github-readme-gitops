import {getOctokit, getAutenticatedUser} from "./index";
import logger from "./logger"
import {CatalogTeamSet, CuratedTeamParameters, GetRepoResponse, GetTeamResponse, GitHubTeamPostfix} from "./types";
import {
    PRODUCT_NAME_REGEX,
    TEAM_SLUG_NAME_REGEX,
    TEAM_NAME_REGEX,
    DEFAULT_SECRETS_FILE_PATH,
    TEAM_SET
} from "./constants";
import {promises as fspromises} from "fs";
import {main} from "ts-node/dist/bin";
import json = Mocha.reporters.json;
import {Octokit} from "@octokit/rest";

const SECRET_FILES_PATH = process.env.SECRET_FILES_PATH || DEFAULT_SECRETS_FILE_PATH;

const getOrgSecrets = async (org: string) => {
    const octokit = await getOctokit();
    let orgSecretsList;
    try {
        logger.debug(`org=${org}`);
        orgSecretsList = await octokit.paginate(octokit.actions.listOrgSecrets, {
            org
        });
        //   logger.debug(`orgSecrets=\n${JSON.stringify(orgSecretsList,null,2)}`);
        return orgSecretsList;

    } catch (error) {
        logger.error(`Error in getting org secrets: ${JSON.stringify(error)}`);
        throw error;
    }

};

const addRepoToSecret = async (org: string, secretName: string, repoId: number) => {
    const octokit = await getOctokit();

    try {
        logger.debug(`org=${org}, secretName=${secretName} repoId=${repoId}`);
        const response = await octokit.actions.addSelectedRepoToOrgSecret({
            org,
            secret_name: secretName,
            repository_id: repoId,
        });
        return response;

    } catch (error) {
        logger.error(`Error in getting adding repo to org secret: ${JSON.stringify(error)}`);
        throw error;
    }
}
const orgReposIDs = async (org: string) => {
    const reposIds = (await getOrgRepos(org)).reduce((repos, repo) => {
        repos[repo.name] = repo.id;
        return repos;
    }, {})
    return reposIds;
}

const getOrgRepos = async (org: string) => {
    const octokit = await getOctokit();
    let orgRepoList;
    try {
        logger.debug(`org=${org}`);
        orgRepoList = await octokit.paginate(octokit.repos.listForOrg, {
            org,
            type: "all"
        });
        //     logger.debug(`orgSecrets=\n${JSON.stringify(orgRepoList, null, 2)}`);
        return orgRepoList;

    } catch (error) {
        logger.error(`Error in getting org secrets: ${JSON.stringify(error)}`);
        throw error;
    }

};

const getOrgEmails = async (org: string) => {
    const octokit = await getOctokit();
    let usersList;
    try {
        logger.debug(`org=${org}`);
        usersList = await octokit.paginate(octokit.orgs.listMembers, {
            org
        },(response) => {
            return response.data.map(async (user) => {
                logger.debug(`${user.login}`);
                const {data:userDetails} = await octokit.users.getByUsername({
                    username: user.login,
                });
                return {
                    username: user.login,
                    fullname: userDetails.name,
                    email: userDetails.email
                };
            })
        });
        logger.debug(`orgSecrets=\n${JSON.stringify(usersList, null, 2)}`);
        return usersList;

    } catch (error) {
        logger.error(`Error in getting org secrets: ${JSON.stringify(error)}`);
        throw error;
    }

};

const removeRepoFromSecret = async (org: string, secretName: string, repoId: number) => {
    const octokit = await getOctokit();

    try {
        logger.debug(`org=${org}, secretName=${secretName} repoIds=${repoId}`);
        const response = await octokit.actions.removeSelectedRepoFromOrgSecret({
            org,
            secret_name: secretName,
            repository_id: repoId,
        });
        return response;

    } catch (error) {
        if (error.status == 404) {
            logger.warn(`Did not find repo ${repoId} for secret repos to org secret ${secretName}`);
            return Promise.resolve();
        }
        logger.error(`Error in getting removing repos to org secret: ${JSON.stringify(error)}`);
        throw error;
    }
}

const setReposToSecret = async (org: string, secretName: string, reposIds: number[]) => {
    const octokit = await getOctokit();

    try {
        logger.debug(`org=${org}, secretName=${secretName} reposIds=${JSON.stringify(reposIds)}`);
        const response = await octokit.actions.setSelectedReposForOrgSecret({
            org,
            secret_name: secretName,
            selected_repository_ids: reposIds,
        });
        return response;

    } catch (error) {
        logger.error(`Error in getting setting repos to org secret: ${JSON.stringify(error)}`);
        throw error;
    }
}

const getOrgSecretAssignedRepos = async (org: string, secretName: string) => {
    const octokit = await getOctokit();
    let secretRepos;
    try {
        logger.debug(`org=${org} secretName=${secretName}`);
        secretRepos = await octokit.paginate(octokit.actions.listSelectedReposForOrgSecret, {
            org,
            secret_name: secretName
        });
        //    logger.debug(`secretRepos=\n${JSON.stringify(secretRepos,null,2)}`);
        return secretRepos;

    } catch (error) {
        logger.error(`Error in getting repos for secret ${secretName}: ${JSON.stringify(error)}`);
        throw error;
    }

};

export {
    getOrgSecrets,
    getOrgSecretAssignedRepos,
    getOrgRepos,
    addRepoToSecret,
    removeRepoFromSecret,
    orgReposIDs,
    setReposToSecret,
    getOrgEmails
};
