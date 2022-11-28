import {Command} from 'commander'
import logger from "./logger"

import {getOrgTeams, getTeamsCatalog, createTeamSet} from "./teams"

const trim = (value) => value.trim();

const validateTeamsSet = async () => {
    if (process.env.NODE_ENV === 'CI') {
        logger.level = "info";
    }
    logger.debug(`Starting validateTeamsSet`);
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name', trim)
    program.requiredOption('-t, --team-name-prefix <type>', 'Team set name prefix', trim)
    program.parse(process.argv);
    const options = program.opts();
    const {teamNamePrefix, orgName} = options;
    if (orgName && teamNamePrefix) {
        try {
            const teamsetFound = (await getTeamsCatalog(orgName)).find(teamset => teamset.namePrefix === teamNamePrefix);
            if (!teamsetFound) {
                const err = `Teamset "${teamNamePrefix}" is not approved for use.`;
                return Promise.reject(err)
            } else {
                logger.debug(`Teamset found ${JSON.stringify(teamsetFound)}`)
                return true;
            }
        } catch (error) {
            logger.error(`Could not scan repo structure catalog ${JSON.stringify(error)}`);
            Promise.reject(error);
        }
    }
    const error = `Failure to validate teamset orgName=${orgName} teamNamePrefix=${teamNamePrefix}`;
    logger.error(error);
    return Promise.reject(error)
};

export {validateTeamsSet}

async function run() {
    try {
        await validateTeamsSet();
        logger.info("Success.")
        process.exit(0);
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }

}

run();

