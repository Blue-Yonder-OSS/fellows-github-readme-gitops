import {Command} from 'commander'
import { expect } from 'chai';
import logger from "../../src/logger"
import {getOrgSecretAssignedRepos, orgReposIDs} from "../../src/org"

const run = async () => {
    logger.info('Asserting secret\'s team association');
    const program = new Command();
    program.requiredOption('-o, --org-name <type>', 'Organization name')
    program.requiredOption('-s, --secret-name <type>', 'Secret to assert')
    program.requiredOption('-j, --jsonResponse <type>', 'Expected JSON array of assigned repos')
    program.parse(process.argv);
    const options = program.opts();
    const {orgName, secretName, jsonResponse} = options;
    try {
        const parsedExpectedJson= JSON.parse(jsonResponse);
        const orgRepos = (await orgReposIDs(orgName));
        logger.info(`Org repos: ${JSON.stringify(orgRepos)}`);
        const response = await getOrgSecretAssignedRepos(orgName, secretName)
        const currentAssignedRepos=response.map(repo => repo.name);
        logger.info(`currentAssignedRepos=${JSON.stringify(currentAssignedRepos)}`);
        expect(currentAssignedRepos).to.have.members(parsedExpectedJson);
    } catch (error){
        logger.error(`Error ${error}`);
        process.exit(1);
    }

}

run();