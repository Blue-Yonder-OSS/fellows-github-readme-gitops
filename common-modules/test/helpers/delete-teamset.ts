import {Command} from 'commander'
import logger from "../../src/logger"

import {removeTeamSet} from "../../src/teams"
import {TEAM_SET} from "../../src/constants"

const run = async () => {
    console.debug(`Starting delete-teamset`);
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name')
    program.option('-t, --teamset <type>', 'Teamset to delete')
    program.parse(process.argv);
    const options = program.opts();
    const orgName: string = options.orgName;
    const teamset: string = options.teamset;
    if (orgName && teamset) {
        try {
            await removeTeamSet({org: orgName, name: teamset});
        } catch (error) {
            logger.error(`Could not remove teamset. Error ${JSON.stringify(error, null, 2)}`)
            process.exit(1);;
        }
        logger.info(`Deleted teamset`)
        process.exit(0);
        return true;
    } else {
        logger.error(`Orgname ${orgName} or teamset ${teamset}`);
        process.exit(1);
    }
}

run();