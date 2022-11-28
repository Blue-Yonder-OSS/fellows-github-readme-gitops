import {getOctokit, getAutenticatedUser, getRepoOrgAssociation} from "./index";
import logger from "./logger"
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
import Bottleneck from "bottleneck";
import {getOrgRepos} from "./org";
const maxOccurances=12;
const limiter = new Bottleneck({
    maxConcurrent: maxOccurances,
    minTime: Math.ceil(1000.0/maxOccurances)
});

interface UBUNTU {
    name: "UBUNTU"
}

interface WINDOWS {
    name: "WINDOWS"
}

interface MACOS {
    name: "MACOS"
}

enum OsCostMultipliers {UBUNTU = 1.0, WINDOWS = 2.0, MACOS = 10.0};

enum OsNames {UBUNTU = "UBUNTU", WINDOWS = "WINDOWS", MACOS = "MACOS"};

export type RawWorkflowStatistics = {
    workflowName: string,
    usage: {
        [k in OsNames]?: {
            "total_ms": number
        }
    }
}

export type RawRepoStatistics = {
    repoName: string,
    repoId: number,
    workflows: Array<RawWorkflowStatistics>
}

export type RawOrgStatistics = Array<RawRepoStatistics>
type usageStats = {
    "total_ms": number
}

type OsStats = {
    [os in OsNames]: usageStats
}

type OrgStatistics = {
    totalUsage: number,
    topProductsSegments: ({
        productsSegmentName: string,
        usage: number
    })[],
    topProducts: ({
        productName: string,
        usage: number
    })[],
    topRepos: ({
        repoName: string,
        usage: number
    })[],
    allProductsSegments: {
        [productsSegment: string]: OsStats
    },
    allProducts: {
        [product: string]: OsStats
    },
    allRepos: {
        [repoName: string]: number
    },
    topOsProducts: {
        UBUNTU: Array<{
            productName: string,
            usage: number
        }>,
        WINDOWS: Array<{
            productName: string,
            usage: number
        }>
        MACOS: Array<{
            productName: string,
            usage: number
        }>
    }
}
const sortProductsOs = (productsStats: { [product: string]: OsStats }, osName: OsNames) => {
    return Object.entries(productsStats).sort(([firstProductName, firstProduct], [secondProductName, secondProduct]) => {
        return secondProduct[osName].total_ms - firstProduct[osName].total_ms;
    }).map(([productName, productStats]) => {
        return {productName, usage: productStats[osName].total_ms}
    })
}

const getAdjustedUse = (osStats: OsStats) => {
    const adjustedUse = (osStats?.UBUNTU?.total_ms || 0.0) * OsCostMultipliers.UBUNTU +
        (osStats?.WINDOWS?.total_ms || 0.0) * OsCostMultipliers.WINDOWS +
        (osStats?.MACOS?.total_ms || 0.0) * OsCostMultipliers.MACOS;
    return adjustedUse;
}

const sortProductsSegments = (productsSegmentsStats: { [productsSegment: string]: OsStats }) => {
    return Object.entries(productsSegmentsStats)
        .map(([productsSegmentName, productsSegmentStats]) => {
            const adjustedUse = getAdjustedUse(productsSegmentStats);
            return {productsSegmentName, usage: adjustedUse};
        })
        .sort((
            {productsSegmentName: firstProductsSegmentName, usage: firstProductsSegmentAdjustedUsage},
            {productsSegmentName: secondProductsSegmentName, usage: secondProductsSegmentAdjustedUsage}) => {
                return secondProductsSegmentAdjustedUsage - firstProductsSegmentAdjustedUsage;
            }
        );
}
const sortProducts = (productsStats: { [product: string]: OsStats }) => {
    return Object.entries(productsStats)
        .map(([productName, productStats]) => {
            const adjustedUse = getAdjustedUse(productStats);
            return {productName, usage: adjustedUse};
        })
        .sort((
            {productName: firstProductName, usage: firstProductAdjustedUsage},
            {productName: secondProductName, usage: secondProductAdjustedUsage}) => {
                return secondProductAdjustedUsage - firstProductAdjustedUsage;
            }
        );
}

const getSortedStats = (orgStatistics: OrgStatistics): OrgStatistics => {
    const sortedOrgStatistics = orgStatistics;
    orgStatistics.topOsProducts.UBUNTU = sortProductsOs(orgStatistics.allProducts, OsNames.UBUNTU);
    orgStatistics.topOsProducts.MACOS = sortProductsOs(orgStatistics.allProducts, OsNames.MACOS);
    orgStatistics.topOsProducts.WINDOWS = sortProductsOs(orgStatistics.allProducts, OsNames.WINDOWS);
    orgStatistics.topProductsSegments = sortProductsSegments(orgStatistics.allProductsSegments);
    orgStatistics.topProducts = sortProducts(orgStatistics.allProducts);
    orgStatistics.topRepos = Object.entries(orgStatistics.allRepos)
        .sort(([firstRepoName, firstRepoUsage],
               [secondRepoName, secondRepoUsage]) => (secondRepoUsage - firstRepoUsage))
        .map(([repoName, usage]) => ({repoName, usage}));
    return sortedOrgStatistics;
}

const getOrgBillingSummary = async (org: string) => {
    const octokit = await getOctokit();
    let billingSummary;
    try {
        logger.debug(`org=${org}`);
        billingSummary = await octokit.billing.getGithubActionsBillingOrg({
            org
        });
        //   logger.debug(`orgSecrets=\n${JSON.stringify(orgSecretsList,null,2)}`);
        return billingSummary;

    } catch (error) {
        logger.error(`Error in getting org billing summary: ${JSON.stringify(error)}`);
        throw error;
    }

};
const getRepoWorkflows = async (org: string, repo: string) => {
    const octokit = await getOctokit();
    logger.debug('About to start getRepoWorkflows')
    const orgWorkflows = await octokit.paginate(
        octokit.actions.listRepoWorkflows, {
            owner: org,
            repo,
        }
    );
    logger.debug('Done getRepoWorkflows')
    return orgWorkflows;
}
const isEmpty = (obj) => {
    return Object.keys(obj).length === 0;
}

const getNewStatsObject = () => {
    return {
        MACOS: {
            total_ms: 0.0
        },
        WINDOWS: {
            total_ms: 0.0
        },
        UBUNTU: {
            total_ms: 0.0
        }
    }
}

const getOrgStatistics = (rawOrgStatistis: RawOrgStatistics) => {
    let orgStatistics: OrgStatistics = {
        totalUsage: 0.0,
        topOsProducts: {MACOS: undefined, UBUNTU: undefined, WINDOWS: undefined},
        allProducts: {}, allProductsSegments: {}, allRepos: {},
        topProducts: [],
        topProductsSegments: [],
        topRepos: []
    };
    orgStatistics = rawOrgStatistis.reduce((state, currentRawRepoStatistics) => {
        const repoName = currentRawRepoStatistics.repoName;
        const {productsSegmentName, productName} = getRepoOrgAssociation(repoName);
        state.allProductsSegments[productsSegmentName] = state.allProductsSegments[productsSegmentName] || getNewStatsObject()
        state.allProducts[productName] = state.allProducts[productName] || getNewStatsObject()
        const repoUsage = currentRawRepoStatistics.workflows.reduce((repoUsage, currentRawRepoStatistics) => {
            const usage = currentRawRepoStatistics?.usage;
            repoUsage.UBUNTU.total_ms += usage?.UBUNTU?.total_ms || 0.0;
            repoUsage.WINDOWS.total_ms += usage?.WINDOWS?.total_ms || 0.0;
            repoUsage.MACOS.total_ms += usage?.MACOS?.total_ms || 0.0;
            return repoUsage;
        }, getNewStatsObject())
        state.allProductsSegments[productsSegmentName] = reduceStats(state.allProductsSegments[productsSegmentName], repoUsage);
        state.allProducts[productName] = reduceStats(state.allProducts[productName], repoUsage);
        const repoAdjustedUsage = getAdjustedUse(repoUsage);
        state.allRepos[repoName] = (state.allRepos[repoName] || 0.0) + repoAdjustedUsage;
        state.totalUsage += repoAdjustedUsage;
        return state;
    }, orgStatistics);
    orgStatistics = getSortedStats(orgStatistics);
    return orgStatistics;
}

const reduceStats = (state: OsStats, stats: OsStats) => {
    const reducedStats: OsStats = {
        MACOS: {total_ms: 0.0}, UBUNTU: {total_ms: 0.0}, WINDOWS: {total_ms: 0.0}
    };
    reducedStats.UBUNTU.total_ms = (stats?.UBUNTU?.total_ms || 0.0) + (state?.UBUNTU?.total_ms || 0.0);
    reducedStats.WINDOWS.total_ms = (stats?.WINDOWS?.total_ms || 0.0) + (state?.WINDOWS?.total_ms || 0.0);
    reducedStats.MACOS.total_ms = (stats?.MACOS?.total_ms || 0.0) + (state?.MACOS?.total_ms || 0.0);
    return reducedStats;
}


const getOrgReposBillingRawData = async (org: string): Promise<RawOrgStatistics> => {
        logger.debug('About to start getOrgReposBillingRawData')
        const octokit = await getOctokit();
        let reposBilling, orgRepos;
        try {
            orgRepos = await getOrgRepos(org)
        } catch (error) {
            logger.error(`Error in getting org repos while trying to get billing: ${JSON.stringify(error)}`);
            throw error;
        }
        logger.debug('Got getOrgRepos')
        try {
            const reposPromises: Array<Promise<RawRepoStatistics>> = orgRepos.map(async (currentRepo): Promise<RawRepoStatistics> => {
                const repoWorkflows = await limiter.schedule(() => getRepoWorkflows(org, currentRepo.name))
                const repoWorkflowsPromises = repoWorkflows.map(currentWorkflow => {
                    return limiter.schedule(async () => {
                        logger.debug(`About to  getWorkflowUsage for repo ${currentRepo.name} workflow ${currentWorkflow}`)
                        const workflowUsage = await octokit.actions.getWorkflowUsage({
                        owner: org,
                        repo: currentRepo.name,
                        workflow_id: currentWorkflow.id,
                    });
                        return <RawWorkflowStatistics>{
                        usage: workflowUsage?.data?.billable || {},
                        workflowName: currentWorkflow.name
                        };
                    });
                });
                const repoWorkflowsResult = await Promise.all(repoWorkflowsPromises);
                return <RawRepoStatistics>{
                    repoName: currentRepo.name,
                    workflows: repoWorkflowsResult,
                    repoId: currentRepo.id
                };
            });
            const allReposBillingRaw = await Promise.all(reposPromises);
            logger.debug('Done getOrgReposBillingRawData')
            return allReposBillingRaw;
        } catch (error) {
            logger.error(`Error in getting org repos billing: ${JSON.stringify(error)}`);
            throw error;
        }

    }
;

export {getOrgBillingSummary, getOrgReposBillingRawData, OrgStatistics, getOrgStatistics};
