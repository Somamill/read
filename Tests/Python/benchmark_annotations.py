"""Offline annotation benchmark; synthetic data only, no account or network access.

Run from the checkout root: python3 Tests/Python/benchmark_annotations.py
Timings are informational, not pass/fail thresholds.
"""
import io
import json
from pathlib import Path
import statistics
import sys
import tempfile
import time
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'Sources/ReadCore/Tools'))
from shelf_annotations import Library, dispatch


def main():
    with tempfile.TemporaryDirectory() as directory:
        library=Library(Path(directory)/'benchmark.sqlite')
        try:
            for i in range(5000):
                library.put({'source':'Readwise','sourceId':str(i+1),'sourceBookId':str(i//50+1),
                             'text':'A synthetic passage '+str(i),'title':'Book '+str(i//50+1),'color':'yellow'},commit=False)
            library.db.commit()
            timings=[]
            for _ in range(5):
                start=time.perf_counter()
                result=dispatch(library,{'action':'list','all':True})
                timings.append(time.perf_counter()-start)
                assert len(result['items'])==5000
                assert len({item['id'] for item in result['review']})==len(result['review'])
            page={'results':[{'user_book_id':i+1,'is_deleted':True} for i in range(100)],'nextPageCursor':None}
            with patch('shelf_annotations.urllib.request.urlopen',return_value=io.BytesIO(json.dumps(page).encode())):
                start=time.perf_counter()
                library.import_readwise('fixture-token')
                deletion=time.perf_counter()-start
            assert all(item['archived'] for item in library.items())
            print(json.dumps({'highlights':5000,'books':100,'refresh_median_seconds':round(statistics.median(timings),6),
                              'book_deletion_seconds':round(deletion,6)}))
        finally:
            library.db.close()


if __name__=='__main__': main()
