import importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('publisher',Path(__file__).parents[1]/'scripts/prepare-development-import.py')
publisher=importlib.util.module_from_spec(spec);spec.loader.exec_module(publisher)
class SQLSafety(unittest.TestCase):
    def test_quotes_preserve_untrusted_content_as_data(self):
        self.assertEqual(publisher.quote("a'); DROP TABLE x; --"),"'a''); DROP TABLE x; --'")
