import {getOctokit} from "./index";
import logger from "./logger"
import {GetReposForOrgResponse, CuratedRepoParameters, GetRepoResponse} from "./types"
import {Repo} from "../../../scripts/best-practices-applier/src/types";
import {PRODUCT_NAME_REGEX, DEFAULT_REPOS_FILE_PATH} from "./constants"
import {promises as fspromises} from "fs";

const REPOS_FILE_PATH = process.env.REPOS_FILE_PATH || DEFAULT_REPOS_FILE_PATH;

const getRepoOrgAssociation = (repoName: string): { productsSegmentName: string, productName: string } => {
    const match = repoName.match(PRODUCT_NAME_REGEX);
    const groups = match?.groups;
    const repoAssociation = {
        productsSegmentName: groups?.segment,
        productName: groups?.segment + '-' + groups?.product
    }
    return repoAssociation;
}
const getReposForOrg = async (org: string): Promise<GetReposForOrgResponse> => {
    const octokit = await getOctokit();
    return await octokit.paginate(octokit.repos.listForOrg, {
        org,
    });
};

const getRepo = async (ownerOrg: string, repoName: string) => {
    const octokit = await getOctokit();
    return (<GetRepoResponse>
            await octokit.repos.get({
                owner: ownerOrg,
                repo: repoName,
            })
    ).data;
};

const deleteRepo = async (repo: { org: string, name: string }) => {
    const octokit = await getOctokit();
    await octokit.repos.delete({owner: repo.org, repo: repo.name});
};

const updateBranchProtection = async (owner: string, repo: string) => {
};

const createCuratedRepo = async (repoParameters: CuratedRepoParameters) => {
    const octokit = await getOctokit();
    const {name, description, org, teams} = repoParameters;
    const visibility = "private";
    let createdRepo;
    createdRepo = (
        await octokit.repos.createInOrg({
            name,
            org,
            description,
            visibility,
        })
    ).data;
    return createdRepo;
};

const validateRepoStandard = async (repoName: string) => {
    let result = true;
    let error = '';
    logger.debug(`Running validateRepoStandard repoName=${repoName} `);
    if (!repoName) {
        logger.error('Repo name not found');
        return false;
    }

    const match = repoName.match(PRODUCT_NAME_REGEX);
    let {segment = 'no-segment', product = 'no-product'} = match?.groups || {};
    if (!match || !product) {
        return false;
    }

    const productCatalog = JSON.parse((await fspromises.readFile(REPOS_FILE_PATH)).toString());
    logger.debug(`Loading file `);

    //  logger.log(JSON.stringify(productCatalog));
    const foundSegment = productCatalog[segment];
    //   logger.debug(`File loaded ${JSON.stringify(foundSegment)}`);
    if (!foundSegment?.products[product]) {
        error = `Repository ${repoName} does not follow naming conventions. Please rename.`;
        logger.error(error);
        result = false;
    }
    //   logger.debug(`Segment is ${segment}, product is ${product}`);
    return result;
};
export {getReposForOrg, getRepo, createCuratedRepo, validateRepoStandard, deleteRepo, getRepoOrgAssociation};
