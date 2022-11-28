import {getOctokit, getAutenticatedUser} from "./index";
import logger from "./logger"
import {CatalogTeamSet, CuratedTeamParameters, GetRepoResponse, GetTeamResponse, GitHubTeamPostfix} from "./types";
import {
    PRODUCT_NAME_REGEX,
    TEAM_SLUG_NAME_REGEX,
    TEAM_NAME_REGEX,
    DEFAULT_TEAMS_FILE_PATH,
    TEAM_SET
} from "./constants";
import {promises as fspromises} from "fs";
import {main} from "ts-node/dist/bin";
import json = Mocha.reporters.json;
import {Octokit} from "@octokit/rest";

const TEAMS_FILE_PATH = process.env.TEAMS_FILE_PATH || DEFAULT_TEAMS_FILE_PATH;
const DEFAULT_EVERYONE_TEAM_SLUG = 'everyone';

const createTeam = async (team: CuratedTeamParameters) => {
    const octokit = await getOctokit();
    let createdTeam;
    try {
        createdTeam = await octokit.teams.create({
            ...team,
        });
        return createdTeam.data;
    } catch (error) {
        logger.error(`Error in createTeam: ${JSON.stringify(error)}`);
        throw error;
    }
};

const getTeam = async (team: { org: string, name: string }) => {
    const {org, name} = team;
    const octokit = await getOctokit();
    try {
        const response = await octokit.request(`GET /orgs/${org}/teams/${name}`);
        return response.data;
    } catch (error) {
        logger.error(`${JSON.stringify(error, null, 2)}`)
        return Promise.reject('Error getTeam')
    }
    logger.debug(`Done getTeam`)
};

const removeTeamMaintainers = async (params: { org: string; teamSlug: string, maintainersToRemove: string[] }) => {
    logger.debug(`About to start removeTeamMaintainers`);
    const octokit = <Octokit>getOctokit();
    const {org, teamSlug, maintainersToRemove} = params;
    try {
        await Promise.all(maintainersToRemove.map(async maintainer => {
            logger.debug(`About to delete org=${org} teamSlug=${teamSlug} member ${maintainer}`);
            await octokit.teams.removeMembershipForUserInOrg({
                org,
                team_slug: teamSlug,
                username: maintainer
            });
            return true;
        }));
    } catch (error) {
        logger.debug(`Error deleted members ${error}`);
        return false;
    }
    logger.debug(`Done deleting members ${JSON.stringify(maintainersToRemove)}`)
    return true;
}

const convertToKebabCase = (team: string) => {
    return team.replace(/\s+/g, '-').toLowerCase();
}

const removeTeamSet = async (teamset: { org: string, name: string; }) => {
    const {name: teamsetName, org} = teamset;
    const adminsTeamSlug = convertToKebabCase(`${teamsetName} ${GitHubTeamPostfix.ADMINS}`);
    const collaboratorsTeamSlug = convertToKebabCase(`${teamsetName} ${GitHubTeamPostfix.COLLABORATORS}`);
    const contributorsTeamSlug = convertToKebabCase(`${teamsetName} ${GitHubTeamPostfix.CONTRIBUTORS}`);
    logger.debug(`Deleting adminsTeamSlug=${adminsTeamSlug} collaboratorsTeamSlug=${collaboratorsTeamSlug} contributorsTeamSlug=${contributorsTeamSlug}`);
    try {
        await Promise.all([
            deleteTeam({org, slug: adminsTeamSlug}),
            deleteTeam({org, slug: collaboratorsTeamSlug}),
            deleteTeam({org, slug: contributorsTeamSlug})]
        )
        logger.debug(`Deleted teamset`);
        return true;
    } catch (error) {
        return Promise.reject(`Error removing teamset ${teamsetName}`)
    }
}
const createTeamSet = async (teamSet: { org: string, teamPrefix: string, maintainers: string[], employeesTeamSlug?: string }): Promise<boolean> => {
    logger.debug(`createTeamSet params: ${JSON.stringify(teamSet)}`)
    const {org, teamPrefix, maintainers, employeesTeamSlug = DEFAULT_EVERYONE_TEAM_SLUG} = teamSet;
    if (org && teamPrefix && maintainers?.length && employeesTeamSlug) {
        try {
            logger.debug('Executing getTeam');
            const employeesTeam = await getTeam({org, name: employeesTeamSlug});
            logger.debug(`employeesTeamSlug=${employeesTeam.slug} employeesTeam=${JSON.stringify(employeesTeam.id)}`);
            const authenticatedUser = (await getAutenticatedUser()).login;
            const contributorsTeam = await createTeam({
                name: `${teamPrefix} ${TEAM_SET.Contributors}`,
                org,
                maintainers: maintainers,
                parent_team_id: employeesTeam.id
            });
            const collaboratorsTeam = await createTeam({
                name: `${teamPrefix} ${TEAM_SET.Collaborators}`,
                org,
                maintainers: maintainers,
                parent_team_id: contributorsTeam.id
            });
            const adminsTeam = await createTeam({
                name: `${teamPrefix} ${TEAM_SET.Admins}`,
                org,
                maintainers: maintainers,
                parent_team_id: collaboratorsTeam.id
            });

            if (!maintainers.some(maintainer => authenticatedUser === maintainer)) {
                try {
                    logger.debug(`authenticatedUser=${authenticatedUser} maintainer=${JSON.stringify(maintainers)}`)
                    await removeTeamMaintainers({
                        org,
                        teamSlug: adminsTeam.slug,
                        maintainersToRemove: [authenticatedUser]
                    });
                    await removeTeamMaintainers({
                        org,
                        teamSlug: collaboratorsTeam.slug,
                        maintainersToRemove: [authenticatedUser]
                    });
                    await removeTeamMaintainers({
                        org,
                        teamSlug: contributorsTeam.slug,
                        maintainersToRemove: [authenticatedUser]
                    });
                } catch (error) {
                    logger.error(`Error in createTeamSet ${error}`)
                    return false;
                }
            }


        } catch (error) {
            logger.error(`Error in createTeamSet ${error}`)
            return false;
        }
    } else {
        logger.error(`Mandatory values missing. 
                        org=${org}, 
                        teamPrefix=${teamPrefix}, 
                        maintainer=${JSON.stringify(maintainers)},
                        employeesTeamSlug=${employeesTeamSlug}`)
    }
    return true;
};


const getTeamsCatalog = async (org: string): Promise<CatalogTeamSet[]> => JSON.parse((await fspromises.readFile(TEAMS_FILE_PATH)).toString());

const getTeamMaintainers = async (org: string, teamSlug: string) => {
    const octokit = await getOctokit();
    try {
        const {data: teamMaintainers} = await octokit.request(`GET /orgs/${org}/teams/${teamSlug}/members?role=maintainer`);
        return teamMaintainers;
    } catch (error) {
        logger.error(`Error getting maintainers ${JSON.stringify(error)}`);
        return Promise.reject(`Error finding team ${teamSlug} maintainers`)
    }
}
const getOrgTeams = async (org: string): Promise<object[]> => {
    const octokit = await getOctokit();
    const teams = {};
    const teamsResponse = await octokit.paginate(
        octokit.teams.list, {
            org,
        }
    );

    for (const team of teamsResponse) {
        const slugMatch = team.slug.match(TEAM_SLUG_NAME_REGEX);
        const nameMatch = team.name.match(TEAM_NAME_REGEX);
        let {slugPrefix, slugSuffix} = slugMatch?.groups || {};
        let {namePrefix, nameSuffix} = nameMatch?.groups || {};

        if (slugMatch) {
            
            const currentTeam = teams[namePrefix] = teams[namePrefix] || {subteams: {}};
            currentTeam.subteams[nameSuffix] = team;
            
            if (slugSuffix === 'admins') {
                const maintainers = (await getTeamMaintainers(org, team.slug)).map(o => o.login);
                currentTeam.maintainers = maintainers;
            }
        }

    }
    const teamsNameCollection = Object.entries(teams).filter(([key, value]) => Object.keys(value['subteams']).length === 3)
        .map(([key, value]) => {
            return {namePrefix: key, maintainers: value['maintainers']};
        });    
    return teamsNameCollection;
}

const deleteTeam = async (team: { org: string, slug: string }) => {
    const octokit = await getOctokit();
    const {org, slug} = team;
    let deleteTeamResponse;
    try {
        deleteTeamResponse = await octokit.teams.deleteInOrg({
            org,
            team_slug: slug,
        });
        return deleteTeamResponse;
    } catch (err) {
        logger.error(JSON.stringify(err, null, 2));
        throw err;
    }
};

export {createTeam, deleteTeam, getOrgTeams, getTeamsCatalog, createTeamSet, removeTeamSet, getTeamMaintainers};
