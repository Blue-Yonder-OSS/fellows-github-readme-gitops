import {Command} from 'commander'
import logger from "./logger"

import {getOrgTeams, getTeamsCatalog, createTeamSet} from "./teams"

const trim = (value) => value.trim();
const createTeamsSet = async () => {
    if (process.env.NODE_ENV === 'CI') {
        logger.level = "info";
    }
    logger.debug(`Starting createTeamsSet`);
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name', trim)
    program.requiredOption('-t, --team-name-prefix <type>', 'Team set name prefix', trim)
    program.requiredOption('-m, --maintainer-id <type>', 'Team set maintainer ID', trim)
    program.option('-e, --employee-team-slug <type>', 'Org employees team slug ID', trim, 'everyone')
    program.parse(process.argv);
    const options = program.opts();
    const {orgName, teamNamePrefix, maintainerId, employeeTeamSlug} = options;
    logger.debug(`Creating team set orgName=${orgName} teamNamePrefix=${teamNamePrefix} employeeTeamSlug=${employeeTeamSlug}`);
    if (orgName && teamNamePrefix && maintainerId) {
        const createTeamResult = await createTeamSet({org:orgName, teamPrefix: teamNamePrefix, maintainers: [maintainerId], employeesTeamSlug:employeeTeamSlug});
        logger.debug(`createTeamResult=${createTeamResult}`);
        if (createTeamResult) {
            return `createTeamResult=${createTeamResult}`;
        }
        else {
            const err='Failure creating teamset';
            return Promise.reject(err)
        }
    }
    const error = `Failure creating teamset orgName=${orgName} teamNamePrefix=${teamNamePrefix} maintainerId=${maintainerId}`;
    logger.error(error);
    return Promise.reject(error)
};

export {createTeamsSet}

async function run() {
    try {
        await createTeamsSet();
        logger.info("Success.")
        process.exit(0);
    } catch (error) {
        logger.error(error);
        process.exit(1);
    }

}
run();

