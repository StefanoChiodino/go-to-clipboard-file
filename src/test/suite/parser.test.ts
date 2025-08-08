import * as assert from 'assert';
import { parseFileReferences, FileLineReference } from '../../parser';

suite('Parser Test Suite', () => {
    test('Parse Python stacktrace with full paths', () => {
        const stacktrace = `Traceback (most recent call last):
  File "/nail/live/yelp/./yelp/web/base_cmd.py", line 287, in run
    return self.execute()
  File "/nail/live/yelp/./admin_cmds/_admin_request_mapper.py", line 61, in execute
    return action(**match)
  File "/nail/live/yelp/./admin_cmds/_admin.py", line 292, in sub_wrapper
    return method(self, _args,_ *kwargs)
  File "/nail/live/yelp/./admin_cmds/payment_account/payment_account.py", line 336, in ledger
    ledger_item_presenter = lib.list_ledger_item_presenters(
  File "/nail/live/yelp/./yelp/billing_common/presentation/admin/payment_account_entity/lib.py", line 83, in list_ledger_item_presenters
    _build_presenters(
  File "/nail/live/yelp/./yelp/billing_common/presentation/admin/payment_account_entity/lib.py", line 149, in _build_presenters
    presenters.extend(
  File "/nail/live/yelp/./yelp/billing_common/presentation/admin/payment_account_entity/transaction_platform_ledger_item_presenter.py", line 12, in list_ledger_item_presenters
    transaction_platform_data = transaction_platform_lib.build_transaction_platform_data(
  File "/nail/live/yelp/./yelp/billing_common/presentation/admin/payment_account_entity/transaction_platform_lib.py", line 24, in build_transaction_platform_data
    yelp_business_map = _build_business_map(conn_token, checkout_order_map)
  File "/nail/live/yelp/./yelp/billing_common/presentation/admin/payment_account_entity/transaction_platform_lib.py", line 137, in _build_business_map
    transaction_to_business_id = dicts.mapdict(
  File "/nail/live/yelp/virtualenv_run/lib/python3.10/site-packages/yelp_lib/containers/dicts.py", line 290, in mapdict
    result_dictionary[key] = function(dictionary[key])
  File "/nail/live/yelp/./yelp/billing_common/presentation/admin/payment_account_entity/transaction_platform_lib.py", line 138, in <lambda>
    lambda x: x.yelp_business_id if x.yelp_business_id is not None else None,
AttributeError: 'NoneType' object has no attribute 'yelp_business_id'`;

        const references = parseFileReferences(stacktrace);
        
        assert.strictEqual(references.length, 11);
        
        assert.strictEqual(references[0].file, '/nail/live/yelp/yelp/web/base_cmd.py');
        assert.strictEqual(references[0].line, 287);
        
        assert.strictEqual(references[1].file, '/nail/live/yelp/admin_cmds/_admin_request_mapper.py');
        assert.strictEqual(references[1].line, 61);
        
        assert.strictEqual(references[10].file, '/nail/live/yelp/yelp/billing_common/presentation/admin/payment_account_entity/transaction_platform_lib.py');
        assert.strictEqual(references[10].line, 138);
    });

    test('Parse Python stacktrace with relative paths', () => {
        const stacktrace = `Traceback (most recent call last):
  File "app/main.py", line 42, in <module>
    run_app()
  File "utils/helper.py", line 15, in run_app
    process_data()`;

        const references = parseFileReferences(stacktrace);
        
        assert.strictEqual(references.length, 2);
        assert.strictEqual(references[0].file, 'app/main.py');
        assert.strictEqual(references[0].line, 42);
        assert.strictEqual(references[1].file, 'utils/helper.py');
        assert.strictEqual(references[1].line, 15);
    });

    test('Parse JavaScript/Node stacktrace', () => {
        const stacktrace = `Error: Something went wrong
    at Object.<anonymous> (/src/index.js:42:15)
    at Module._compile (internal/modules/cjs/loader.js:1063:30)
    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1092:10)
    at Module.load (/app/src/utils/helper.js:123:8)`;

        const references = parseFileReferences(stacktrace);
        
        assert.strictEqual(references.length, 4);
        assert.strictEqual(references[0].file, '/src/index.js');
        assert.strictEqual(references[0].line, 42);
        assert.strictEqual(references[0].column, 15);
        
        assert.strictEqual(references[3].file, '/app/src/utils/helper.js');
        assert.strictEqual(references[3].line, 123);
        assert.strictEqual(references[3].column, 8);
    });

    test('Parse generic file:line patterns', () => {
        const text = `Error in src/components/Button.tsx:45
Failed at utils/helper.js:123:8
Check file.py:99`;

        const references = parseFileReferences(text);
        
        assert.strictEqual(references.length, 3);
        assert.strictEqual(references[0].file, 'src/components/Button.tsx');
        assert.strictEqual(references[0].line, 45);
        assert.strictEqual(references[0].column, undefined);
        
        assert.strictEqual(references[1].file, 'utils/helper.js');
        assert.strictEqual(references[1].line, 123);
        assert.strictEqual(references[1].column, 8);
        
        assert.strictEqual(references[2].file, 'file.py');
        assert.strictEqual(references[2].line, 99);
    });

    test('Handle Windows paths', () => {
        const text = `Error at C:\\Users\\john\\project\\file.js:42
File "D:\\workspace\\app.py", line 100`;

        const references = parseFileReferences(text);
        
        assert.strictEqual(references.length, 2);
        assert.strictEqual(references[0].file, 'C:\\Users\\john\\project\\file.js');
        assert.strictEqual(references[0].line, 42);
        
        assert.strictEqual(references[1].file, 'D:\\workspace\\app.py');
        assert.strictEqual(references[1].line, 100);
    });

    test('Return empty array for text without file references', () => {
        const text = `This is just some regular text
without any file references
or line numbers`;

        const references = parseFileReferences(text);
        assert.strictEqual(references.length, 0);
    });

    test('Deduplicate identical references', () => {
        const text = `File "app.py", line 42
File "app.py", line 42
app.py:42`;

        const references = parseFileReferences(text);
        assert.strictEqual(references.length, 1);
        assert.strictEqual(references[0].file, 'app.py');
        assert.strictEqual(references[0].line, 42);
    });

    test('Ignore invalid line numbers', () => {
        const text = `File "app.py", line 0
File "test.py", line -5
File "valid.py", line 42`;

        const references = parseFileReferences(text);
        assert.strictEqual(references.length, 1);
        assert.strictEqual(references[0].file, 'valid.py');
        assert.strictEqual(references[0].line, 42);
    });

    test('Parse mixed format stacktraces', () => {
        const text = `Python error:
  File "python_file.py", line 100, in function
    do_something()
    
JavaScript error:
    at someFunction (js_file.js:50:10)
    
Generic reference: check out config.yaml:25`;

        const references = parseFileReferences(text);
        assert.strictEqual(references.length, 3);
        
        assert.strictEqual(references[0].file, 'python_file.py');
        assert.strictEqual(references[0].line, 100);
        
        assert.strictEqual(references[1].file, 'js_file.js');
        assert.strictEqual(references[1].line, 50);
        assert.strictEqual(references[1].column, 10);
        
        assert.strictEqual(references[2].file, 'config.yaml');
        assert.strictEqual(references[2].line, 25);
    });

    test('Should strip ./ prefix from Python stacktrace paths', () => {
        const stacktrace = `  File "/nail/live/yelp/./yelp/web/base_cmd.py", line 287, in run
  File "./admin_cmds/_admin.py", line 292, in sub_wrapper
  File "/path/./to/./file.py", line 100`;

        const references = parseFileReferences(stacktrace);
        assert.strictEqual(references.length, 3);
        assert.strictEqual(references[0].file, '/nail/live/yelp/yelp/web/base_cmd.py');
        assert.strictEqual(references[1].file, 'admin_cmds/_admin.py');
        assert.strictEqual(references[2].file, '/path/to/file.py');
    });

    test('Should strip ./ from relative paths', () => {
        const text = `./src/main.ts:42
./test/unit/parser.test.ts:100:5
file.js:10`;

        const references = parseFileReferences(text);
        assert.strictEqual(references.length, 3);
        assert.strictEqual(references[0].file, 'src/main.ts');
        assert.strictEqual(references[0].line, 42);
        assert.strictEqual(references[1].file, 'test/unit/parser.test.ts');
        assert.strictEqual(references[1].line, 100);
        assert.strictEqual(references[1].column, 5);
        assert.strictEqual(references[2].file, 'file.js');
        assert.strictEqual(references[2].line, 10);
    });

    test('Should handle paths with multiple ./ segments', () => {
        const stacktrace = `  File "/project/./src/./utils/./helper.py", line 45`;
        const references = parseFileReferences(stacktrace);
        assert.strictEqual(references.length, 1);
        assert.strictEqual(references[0].file, '/project/src/utils/helper.py');
        assert.strictEqual(references[0].line, 45);
    });

    test('Should preserve originalText field', () => {
        const text = 'Check file.py:42 for details';
        const references = parseFileReferences(text);
        assert.strictEqual(references.length, 1);
        assert.strictEqual(references[0].originalText, 'file.py:42');
        assert.strictEqual(references[0].file, 'file.py');
        assert.strictEqual(references[0].line, 42);
    });

    test('Should handle home directory paths', () => {
        const text = '~/projects/myapp/main.py:78:12';
        const references = parseFileReferences(text);
        assert.strictEqual(references.length, 1);
        assert.strictEqual(references[0].file, '~/projects/myapp/main.py');
        assert.strictEqual(references[0].line, 78);
        assert.strictEqual(references[0].column, 12);
    });

    test('Should handle complex nested Python stacktrace', () => {
        const stacktrace = `Traceback (most recent call last):
  File "/usr/local/lib/python3.9/site-packages/package/module.py", line 234, in wrapper
    return func(*args, **kwargs)
  File "./local/./app/./main.py", line 45, in process
    data = load_data()
  File "/home/user/./project/./src/./data_loader.py", line 78, in load_data
    return parse_json(content)`;

        const references = parseFileReferences(stacktrace);
        assert.strictEqual(references.length, 3);
        assert.strictEqual(references[0].file, '/usr/local/lib/python3.9/site-packages/package/module.py');
        assert.strictEqual(references[0].line, 234);
        assert.strictEqual(references[1].file, 'local/app/main.py');
        assert.strictEqual(references[1].line, 45);
        assert.strictEqual(references[2].file, '/home/user/project/src/data_loader.py');
        assert.strictEqual(references[2].line, 78);
    });
});