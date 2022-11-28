import {Command} from 'commander'
import logger from "./logger"

import {getOrgTeams, getTeamsCatalog, createTeamSet} from "./teams"
import {getOrgEmails} from "./org";

const trim = (value) => value.trim();

const validateTeamsSet = async () => {
    if (process.env.NODE_ENV === 'CI') {
        logger.level = "info";
    }
    logger.debug(`Starting validateTeamsSet`);
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name', trim)
    program.parse(process.argv);
    const options = program.opts();
    const {orgName} = options;
    if (orgName) {
        try {
            const usersEmails = (await getOrgEmails(orgName));
            return usersEmails
        } catch (error) {
            logger.error(`Could not scan repo structure catalog ${JSON.stringify(error)}`);
            Promise.reject(error);
        }
    }
    const error = `Failure to get users emails orgName=${orgName}`;
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

